#!/usr/bin/env python3
"""
Export top referenced verses per book with text and passage groups.

Generates a JSON file containing the most-referenced verses for each book,
including verse text and any passage group associations.
"""

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.db.connection import get_connection
from src.data.book_mapping import CPDV_BOOK_ID_TO_ABBREV

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data"

# Book order (1-73 CPDV canonical order)
BOOK_ORDER = [CPDV_BOOK_ID_TO_ABBREV[i] for i in range(1, 74)]

# OT ends at book 46 (Malachi), NT starts at book 47 (Matthew)
OT_BOOKS = set(BOOK_ORDER[:46])
NT_BOOKS = set(BOOK_ORDER[46:])

# Cross-reference source filter
SOURCE_FILTER = ['Haydock']

# How many top verses to include per book (None = all)
TOP_N_PER_BOOK = None


def get_top_verses_per_book(conn, direction: str, source_filter: list[str] = None) -> dict:
    """
    Get top referenced verses for each book.

    Args:
        conn: Neo4j connection
        direction: 'ot_to_nt' or 'nt_to_ot'
        source_filter: List of sources to filter by

    Returns:
        Dict mapping book IDs to list of top verse info
    """
    if direction == 'ot_to_nt':
        from_books = OT_BOOKS
        to_books = NT_BOOKS
    else:
        from_books = NT_BOOKS
        to_books = OT_BOOKS

    # Query to get cross-references with verse text and passage groups
    query = """
        MATCH (from:Verse)-[r:CROSS_REFERENCES]->(to:Verse)
        WHERE from.book_id IN $from_books
          AND to.book_id IN $to_books
          AND ($sources IS NULL OR any(s IN r.sources WHERE s IN $sources))
        RETURN from.id AS from_id,
               from.book_id AS from_book,
               from.text AS from_text,
               to.id AS to_id,
               to.book_id AS to_book,
               to.text AS to_text,
               r.passage_group AS passage_group,
               r.sources AS sources
    """

    params = {
        "from_books": list(from_books),
        "to_books": list(to_books),
        "sources": source_filter if source_filter else None
    }

    # Aggregate references by source verse
    verse_refs = defaultdict(lambda: {
        "from_id": None,
        "from_book": None,
        "from_text": None,
        "targets": [],
        "count": 0
    })

    with conn.session() as session:
        result = session.run(query, **params)

        for record in result:
            from_id = record["from_id"]

            if verse_refs[from_id]["from_id"] is None:
                verse_refs[from_id]["from_id"] = from_id
                verse_refs[from_id]["from_book"] = record["from_book"]
                verse_refs[from_id]["from_text"] = record["from_text"]

            verse_refs[from_id]["targets"].append({
                "to_id": record["to_id"],
                "to_book": record["to_book"],
                "to_text": record["to_text"],
                "passage_group": record["passage_group"]
            })
            verse_refs[from_id]["count"] += 1

    # Group by book and get top N per book
    book_verses = defaultdict(list)
    for verse_id, info in verse_refs.items():
        book_verses[info["from_book"]].append(info)

    # Sort each book's verses by count and take top N (or all if None)
    top_verses = {}
    for book_id, verses in book_verses.items():
        sorted_verses = sorted(verses, key=lambda x: x["count"], reverse=True)
        if TOP_N_PER_BOOK is not None:
            top_verses[book_id] = sorted_verses[:TOP_N_PER_BOOK]
        else:
            top_verses[book_id] = sorted_verses

    return top_verses


def format_verse_id(verse_id: str) -> str:
    """Convert GEN-1-1 to Genesis 1:1 format."""
    parts = verse_id.split("-")
    if len(parts) >= 3:
        book = parts[0]
        chapter = parts[1]
        verse = parts[2]
        return f"{book} {chapter}:{verse}"
    return verse_id


def expand_passage_groups(verses_data: dict, conn) -> dict:
    """
    For verses that are part of a passage group, fetch the full group.
    """
    # Collect all passage groups we need to expand
    passage_groups_to_fetch = set()
    for book_id, verses in verses_data.items():
        for verse in verses:
            for target in verse["targets"]:
                if target["passage_group"]:
                    passage_groups_to_fetch.add((verse["from_id"], target["passage_group"]))

    if not passage_groups_to_fetch:
        return verses_data

    print(f"Expanding {len(passage_groups_to_fetch)} passage groups...")

    # Query for passage group members
    passage_group_members = {}

    with conn.session() as session:
        for source_id, pg in passage_groups_to_fetch:
            result = session.run("""
                MATCH (source:Verse {id: $source_id})-[r:CROSS_REFERENCES]->(target:Verse)
                WHERE r.passage_group = $passage_group
                RETURN target.id AS verse_id, target.text AS text
                ORDER BY target.book_id, target.chapter, target.verse
            """, source_id=source_id, passage_group=pg)

            members = [{"id": r["verse_id"], "text": r["text"]} for r in result]
            passage_group_members[(source_id, pg)] = members

    # Update the data with expanded passage groups
    for book_id, verses in verses_data.items():
        for verse in verses:
            for target in verse["targets"]:
                if target["passage_group"]:
                    key = (verse["from_id"], target["passage_group"])
                    if key in passage_group_members:
                        target["passage_members"] = passage_group_members[key]

    return verses_data


def export_top_verses():
    """Main export function."""
    print("Connecting to Neo4j...")
    conn = get_connection()
    conn.connect()

    try:
        print("Querying top verses (OT -> NT)...")
        ot_to_nt = get_top_verses_per_book(conn, 'ot_to_nt', SOURCE_FILTER)
        ot_to_nt = expand_passage_groups(ot_to_nt, conn)

        print("Querying top verses (NT -> OT)...")
        nt_to_ot = get_top_verses_per_book(conn, 'nt_to_ot', SOURCE_FILTER)
        nt_to_ot = expand_passage_groups(nt_to_ot, conn)

        # Count totals
        ot_count = sum(len(v) for v in ot_to_nt.values())
        nt_count = sum(len(v) for v in nt_to_ot.values())
        print(f"Top verses: OT={ot_count}, NT={nt_count}")

        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Export combined file
        output = {
            "metadata": {
                "generated": datetime.utcnow().isoformat() + "Z",
                "source": " + ".join(SOURCE_FILTER) if SOURCE_FILTER else "All Sources",
                "topN": TOP_N_PER_BOOK
            },
            "otToNt": ot_to_nt,
            "ntToOt": nt_to_ot
        }

        output_path = OUTPUT_DIR / "top-verses.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"Exported to {output_path}")

    finally:
        conn.close()


if __name__ == "__main__":
    export_top_verses()
