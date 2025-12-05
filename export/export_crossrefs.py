#!/usr/bin/env python3
"""
Export cross-reference data to JSON for the scrollytelling visualization.

Generates two files:
- crossrefs-ot-to-nt.json: References from OT books to NT books
- crossrefs-nt-to-ot.json: References from NT books to OT books

Uses Haydock source by default (Catholic perspective, covers all 73 books).
"""

import json
import sys
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
# Options: ['Haydock'], ['TSK'], ['Haydock', 'TSK'], or None for all
SOURCE_FILTER = ['Haydock']


def build_verse_positions(conn) -> dict[str, int]:
    """Build a mapping of verse IDs to their x-axis positions."""
    print("Building verse position index...")

    # Get verse counts per book first
    with conn.session() as session:
        result = session.run("""
            MATCH (v:Verse)
            RETURN v.book_id AS book, count(v) AS verse_count
        """)
        verse_counts = {r["book"]: r["verse_count"] for r in result}

    # Calculate book start positions
    book_start_positions = {}
    current_pos = 0
    for book in BOOK_ORDER:
        book_start_positions[book] = current_pos
        current_pos += verse_counts.get(book, 0)

    # Query all verses and assign positions
    with conn.session() as session:
        result = session.run("""
            MATCH (v:Verse)
            RETURN v.id AS verse_id, v.book_id AS book, v.chapter AS chapter, v.verse AS verse
            ORDER BY v.book_id, v.chapter, v.verse
        """)

        verse_positions = {}
        book_verse_counter = {book: 0 for book in BOOK_ORDER}

        for record in result:
            verse_id = record["verse_id"]
            book = record["book"]

            if book in book_start_positions:
                pos = book_start_positions[book] + book_verse_counter[book]
                verse_positions[verse_id] = pos
                book_verse_counter[book] += 1

    print(f"Indexed {len(verse_positions):,} verse positions")
    return verse_positions


def query_crossrefs(conn, verse_positions: dict[str, int], source_filter: list[str] = None):
    """Query cross-references from Neo4j."""
    print(f"Querying cross-references (source: {source_filter or 'all'})...")

    # Build query with optional source filter
    if source_filter:
        query = """
            MATCH (a:Verse)-[r:CROSS_REFERENCES]->(b:Verse)
            WHERE any(s IN r.sources WHERE s IN $sources)
            RETURN a.id AS from_id, a.book_id AS from_book,
                   b.id AS to_id, b.book_id AS to_book,
                   r.votes AS votes, r.sources AS sources
        """
        params = {"sources": source_filter}
    else:
        query = """
            MATCH (a:Verse)-[r:CROSS_REFERENCES]->(b:Verse)
            RETURN a.id AS from_id, a.book_id AS from_book,
                   b.id AS to_id, b.book_id AS to_book,
                   r.votes AS votes, r.sources AS sources
        """
        params = {}

    with conn.session() as session:
        result = session.run(query, **params)

        crossrefs = []
        for record in result:
            from_id = record["from_id"]
            to_id = record["to_id"]

            # Skip if we don't have positions for these verses
            if from_id not in verse_positions or to_id not in verse_positions:
                continue

            crossrefs.append({
                "fromId": from_id,
                "fromBook": record["from_book"],
                "fromPosition": verse_positions[from_id],
                "toId": to_id,
                "toBook": record["to_book"],
                "toPosition": verse_positions[to_id],
                "sources": record["sources"],
                "votes": record["votes"]
            })

    print(f"Found {len(crossrefs):,} cross-references")
    return crossrefs


def filter_cross_testament(crossrefs: list[dict]) -> tuple[list[dict], list[dict]]:
    """Separate cross-references into OT->NT and NT->OT."""
    ot_to_nt = []
    nt_to_ot = []

    for ref in crossrefs:
        from_is_ot = ref["fromBook"] in OT_BOOKS
        to_is_ot = ref["toBook"] in OT_BOOKS

        # Only keep cross-testament references
        if from_is_ot and not to_is_ot:
            ot_to_nt.append(ref)
        elif not from_is_ot and to_is_ot:
            nt_to_ot.append(ref)

    return ot_to_nt, nt_to_ot


def export_crossrefs():
    """Main export function."""
    print("Connecting to Neo4j...")
    conn = get_connection()
    conn.connect()

    try:
        # Build verse position index
        verse_positions = build_verse_positions(conn)

        # Query cross-references
        crossrefs = query_crossrefs(conn, verse_positions, SOURCE_FILTER)

        # Filter to cross-testament only
        ot_to_nt, nt_to_ot = filter_cross_testament(crossrefs)

        print(f"Cross-testament references:")
        print(f"  OT -> NT: {len(ot_to_nt):,}")
        print(f"  NT -> OT: {len(nt_to_ot):,}")

        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Common metadata
        source_label = " + ".join(SOURCE_FILTER) if SOURCE_FILTER else "All Sources"
        timestamp = datetime.utcnow().isoformat() + "Z"

        # Export OT -> NT
        ot_to_nt_output = {
            "metadata": {
                "generated": timestamp,
                "source": source_label,
                "direction": "OT to NT",
                "count": len(ot_to_nt)
            },
            "references": ot_to_nt
        }

        ot_to_nt_path = OUTPUT_DIR / "crossrefs-ot-to-nt.json"
        with open(ot_to_nt_path, "w") as f:
            json.dump(ot_to_nt_output, f, indent=2)
        print(f"Exported OT->NT to {ot_to_nt_path}")

        # Export NT -> OT
        nt_to_ot_output = {
            "metadata": {
                "generated": timestamp,
                "source": source_label,
                "direction": "NT to OT",
                "count": len(nt_to_ot)
            },
            "references": nt_to_ot
        }

        nt_to_ot_path = OUTPUT_DIR / "crossrefs-nt-to-ot.json"
        with open(nt_to_ot_path, "w") as f:
            json.dump(nt_to_ot_output, f, indent=2)
        print(f"Exported NT->OT to {nt_to_ot_path}")

    finally:
        conn.close()


if __name__ == "__main__":
    export_crossrefs()
