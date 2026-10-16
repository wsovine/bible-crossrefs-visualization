#!/usr/bin/env python3
"""
Export book metadata to JSON for the scrollytelling visualization.

Generates books.json with:
- Book positions (cumulative verse counts)
- Testament classification
- Deuterocanonical flags
- Verse counts per book
- Date information (composition and events)
"""

import json
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path for imports
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from src.db.connection import get_connection
from src.data.book_mapping import DEUTEROCANONICAL_BOOKS

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "data"


def get_books_from_neo4j(conn) -> list[dict]:
    """Query Book nodes directly from Neo4j with verse counts."""
    with conn.session() as session:
        result = session.run("""
            MATCH (b:Book)
            OPTIONAL MATCH (b)-[:CONTAINS]->(v:Verse)
            WITH b, count(v) AS verseCount
            ORDER BY b.order
            RETURN b.id AS id,
                   b.name AS name,
                   b.order AS order,
                   b.testament AS testament,
                   b.isDeuterocanonical AS isDeuterocanonical,
                   b.dateWrittenStart AS dateWrittenStart,
                   b.dateWrittenEnd AS dateWrittenEnd,
                   b.dateEventsStart AS dateEventsStart,
                   b.dateEventsEnd AS dateEventsEnd,
                   verseCount
        """)
        return [dict(r) for r in result]


def calculate_book_positions(books: list[dict]) -> list[dict]:
    """Add cumulative position information to each book."""
    current_pos = 0

    for book in books:
        verse_count = book["verseCount"]
        book["startPosition"] = current_pos
        book["endPosition"] = current_pos + verse_count - 1 if verse_count > 0 else current_pos
        current_pos += verse_count

    return books


def export_books():
    """Main export function."""
    print("Connecting to Neo4j...")
    conn = get_connection()
    conn.connect()

    try:
        print("Querying Book nodes...")
        books = get_books_from_neo4j(conn)
        print(f"Found {len(books)} books")

        print("Calculating book positions...")
        books = calculate_book_positions(books)

        total_verses = sum(b["verseCount"] for b in books)
        print(f"Total verses: {total_verses:,}")

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
        print(f"  With date info: {sum(1 for b in books if b['dateWrittenStart'] is not None)} books")

    finally:
        conn.close()


if __name__ == "__main__":
    export_books()
