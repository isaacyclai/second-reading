import asyncio
import os
from dotenv import load_dotenv
from db_async import execute

load_dotenv()

async def inspect():
    print("Inspecting for duplicate bills...")
    
    # 1. Find titles that appear more than once
    query = """
    SELECT min(b.title) as title, COUNT(*) as count, array_agg(b.id) as ids
    FROM bills b
    GROUP BY lower(trim(b.title))
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    """
    
    duplicates = await execute(query, fetch=True)
    
    if not duplicates:
        print("No duplicate bills found!")
        return

    print(f"Found {len(duplicates)} sets of duplicate bills:")
    print("-" * 120)
    print(f"{'Count':<6} {'Title'}")
    print("-" * 120)
    
    total_dupes = 0
    for row in duplicates:
        print(f"{row['count']:<6} {row['title']}")
        total_dupes += row['count'] - 1
        
        # Detailed breakdown of the bills
        ids = row['ids']
        for bill_id in ids:
            # Get info about sections linked to this bill
            stats = await execute(
                """
                SELECT COUNT(*) as section_count, MIN(date) as first_date
                FROM sections s
                JOIN sessions sess ON s.session_id = sess.id
                WHERE s.bill_id = $1
                """,
                bill_id,
                fetch=True
            )
            count = stats[0]['section_count']
            date = stats[0]['first_date']
            print(f"       - ID: {bill_id} | Sections: {count} | First Seen: {date}")
    
    print("-" * 120)
    print(f"Total redundant records to merge: {total_dupes}")

if __name__ == "__main__":
    asyncio.run(inspect())
