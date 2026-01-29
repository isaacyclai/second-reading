
import asyncio
import os
from dotenv import load_dotenv
from db_async import execute

load_dotenv()

async def cleanup():
    # 1. Get Session IDs for the date range
    session_query = """
    SELECT id, date 
    FROM sessions 
    WHERE date >= '2025-09-22' AND date <= '2025-09-26'
    """
    sessions = await execute(session_query, fetch=True)
    session_ids = [str(row['id']) for row in sessions]
    
    if not sessions:
        print("No sessions found in range.")
        return

    print(f"Cleaning duplicates in {len(sessions)} sessions...")
    
    # 2. De-duplicate using a single SQL command
    # We identify duplicates by (session_id, section_title, section_type)
    # We keep the one with the oldest created_at (or just pick one if timestamps are identical)
    
    cleanup_query = """
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY session_id, section_title, section_type 
                   ORDER BY created_at ASC, id ASC
               ) as rnum
        FROM sections
        WHERE session_id = ANY($1::uuid[])
    )
    DELETE FROM sections
    WHERE id IN (
        SELECT id FROM duplicates WHERE rnum > 1
    );
    """
    
    # Execute the cleanup
    # We need to pass the list of UUIDs correctly
    # asyncpg expects a list for ARRAY types
    
    print("Executing cleanup query...")
    # execute returns the status string, e.g., "DELETE 150"
    status = await execute(cleanup_query, session_ids)
    
    print(f"Cleanup complete. DB Status: {status}")

if __name__ == "__main__":
    asyncio.run(cleanup())
