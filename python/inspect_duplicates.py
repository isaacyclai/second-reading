
import asyncio
import os
from dotenv import load_dotenv
from db_async import execute

load_dotenv()

async def inspect():
    # 1. Get Session IDs for the date range
    session_query = """
    SELECT id, date 
    FROM sessions 
    WHERE date >= '2025-09-22' AND date <= '2025-09-26'
    ORDER BY date
    """
    sessions = await execute(session_query, fetch=True)
    session_ids = [str(row['id']) for row in sessions]
    
    if not sessions:
        print("No sessions found in range.")
        return

    print(f"Inspecting {len(sessions)} sessions for duplicate sections...")
    
    # 2. Check for duplicate sections in these sessions
    # We define a duplicate as having the same session_id and section_title
    # (Checking content might be safer, but title is a good start)
    
    for sess in sessions:
        print(f"\nChecking Session {sess['date']} ({sess['id']})...")
        
        # Count total sections
        count_query = "SELECT COUNT(*) FROM sections WHERE session_id = $1"
        total = await execute(count_query, sess['id'], fetch=True)
        total_count = total[0]['count']
        
        # Find duplicates grouping by title
        dup_query = """
        SELECT section_title, COUNT(*) as count, array_agg(id) as ids
        FROM sections 
        WHERE session_id = $1
        GROUP BY section_title
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        LIMIT 10
        """
        duplicates = await execute(dup_query, sess['id'], fetch=True)
        
        print(f"  Total Sections: {total_count}")
        print(f"  Duplicate Titles Found: {len(duplicates)}")
        
        if duplicates:
            print(f"  Top 5 Duplicates:")
            for d in duplicates[:5]:
                print(f"    - '{d['section_title']}' (Count: {d['count']})")

if __name__ == "__main__":
    asyncio.run(inspect())
