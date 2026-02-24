"""
Cleanup duplicate sections in the SQLite database.
Duplicates are identified by (sitting_id, section_title, section_type).
"""

import sys
from datetime import datetime

from db_sqlite import get_connection, close_connection, init_db


def cleanup(start_date_str, end_date_str, keep_newest=False):
    init_db()
    conn = get_connection()

    start_date = datetime.strptime(start_date_str, '%d-%m-%Y').strftime('%Y-%m-%d')
    end_date = datetime.strptime(end_date_str, '%d-%m-%Y').strftime('%Y-%m-%d')

    # 1. Get sittings in the date range
    sittings = conn.execute(
        "SELECT id, date FROM sittings WHERE date >= ? AND date <= ?",
        (start_date, end_date)
    ).fetchall()

    if not sittings:
        print(f"No sittings found in range {start_date_str} to {end_date_str}.")
        return

    sitting_ids = [row[0] for row in sittings]
    print(f"Cleaning duplicates in {len(sittings)} sitting(s)...")

    # 2. Count duplicates before deletion
    placeholders = ','.join('?' * len(sitting_ids))
    order = 'DESC' if keep_newest else 'ASC'

    count_query = f"""
    SELECT COUNT(*) FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY sitting_id, section_title, section_type
                   ORDER BY created_at {order}, id ASC
               ) as rnum
        FROM sections
        WHERE sitting_id IN ({placeholders})
    ) WHERE rnum > 1
    """
    dup_count = conn.execute(count_query, sitting_ids).fetchone()[0]
    print(f"Found {dup_count} duplicate section(s).")

    if dup_count == 0:
        print("Nothing to clean up.")
        close_connection()
        return

    # 3. Delete duplicates (keep first by created_at, or newest if --keep-newest)
    delete_query = f"""
    DELETE FROM sections
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY sitting_id, section_title, section_type
                       ORDER BY created_at {order}, id ASC
                   ) as rnum
            FROM sections
            WHERE sitting_id IN ({placeholders})
        ) WHERE rnum > 1
    )
    """
    conn.execute(delete_query, sitting_ids)
    conn.commit()

    print(f"Deleted {dup_count} duplicate section(s).")

    # 4. Show remaining counts
    remaining = conn.execute("SELECT COUNT(*) FROM sections").fetchone()[0]
    print(f"Total sections remaining: {remaining}")

    close_connection()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: uv run cleanup_duplicates_sqlite.py START_DATE [END_DATE] [--keep-newest]")
        print("Example: uv run cleanup_duplicates_sqlite.py 22-09-2025")
        sys.exit(1)

    args = sys.argv[1:]
    dates = [arg for arg in args if not arg.startswith('--')]

    start = dates[0]
    end = dates[1] if len(dates) > 1 else start
    keep_newest = "--keep-newest" in args

    cleanup(start, end, keep_newest)
