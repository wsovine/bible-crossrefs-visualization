#!/usr/bin/env python3
"""
Export book metadata to JSON for the scrollytelling visualization.

Generates books.json with:
- Book positions (cumulative verse counts)
- Testament classification
- Deuterocanonical flags
- Verse counts per book
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.db.connection import get_connection
from src.data.book_mapping import CPDV_BOOK_ID_TO_ABBREV, STANDARD_TO_BOOK_NAME

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data"

# Book order (1-73 CPDV canonical order)
BOOK_ORDER = [CPDV_BOOK_ID_TO_ABBREV[i] for i in range(1, 74)]

# OT ends at book 46 (Malachi), NT starts at book 47 (Matthew)
OT_BOOKS = set(BOOK_ORDER[:46])
NT_BOOKS = set(BOOK_ORDER[46:])

# Deuterocanonical books (7 books not in Protestant canon)
DEUTEROCANONICAL_BOOKS = {"TOB", "JDT", "WIS", "SIR", "BAR", "1MA", "2MA"}


def get_verse_counts(conn) -> dict[str, int]:
    """Query verse counts per book from Neo4j."""
    with conn.session() as session:
        result = session.run("""
            MATCH (v:Verse)
            RETURN v.book_id AS book, count(v) AS verse_count
            ORDER BY book
        """)
        return {r["book"]: r["verse_count"] for r in result}


def calculate_book_positions(verse_counts: dict[str, int]) -> list[dict]:
    """Calculate cumulative positions for each book."""
    books = []
    current_pos = 0

    for i, book_id in enumerate(BOOK_ORDER, start=1):
        verse_count = verse_counts.get(book_id, 0)
        book_name = STANDARD_TO_BOOK_NAME.get(book_id, book_id)

        books.append({
            "id": book_id,
            "name": book_name,
            "order": i,
            "testament": "OT" if book_id in OT_BOOKS else "NT",
            "startPosition": current_pos,
            "endPosition": current_pos + verse_count - 1,
            "verseCount": verse_count,
            "isDeuterocanonical": book_id in DEUTEROCANONICAL_BOOKS
        })

        current_pos += verse_count

    return books


def export_books():
    """Main export function."""
    print("Connecting to Neo4j...")
    conn = get_connection()
    conn.connect()

    try:
        print("Querying verse counts...")
        verse_counts = get_verse_counts(conn)
        total_verses = sum(verse_counts.values())
        print(f"Total verses: {total_verses:,}")

        print("Calculating book positions...")
        books = calculate_book_positions(verse_counts)

        # Find OT/NT boundary
        ot_end = next(b for b in books if b["id"] == "MAL")
        nt_start = next(b for b in books if b["id"] == "MAT")

        # Build output structure
        output = {
            "metadata": {
                "generated": datetime.utcnow().isoformat() + "Z",
                "source": "LogosGraph Neo4j Database",
                "bookCount": len(books),
                "totalVerses": total_verses
            },
            "totalVerses": total_verses,
            "otEndPosition": ot_end["endPosition"],
            "ntStartPosition": nt_start["startPosition"],
            "deuterocanonicalBooks": sorted(DEUTEROCANONICAL_BOOKS),
            "books": books
        }

        # Ensure output directory exists
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Write JSON
        output_path = OUTPUT_DIR / "books.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)

        print(f"Exported {len(books)} books to {output_path}")
        print(f"  OT: {sum(1 for b in books if b['testament'] == 'OT')} books")
        print(f"  NT: {sum(1 for b in books if b['testament'] == 'NT')} books")
        print(f"  Deuterocanonical: {sum(1 for b in books if b['isDeuterocanonical'])} books")

    finally:
        conn.close()


if __name__ == "__main__":
    export_books()
