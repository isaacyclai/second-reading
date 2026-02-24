import asyncio
import sys
from datetime import datetime
from dotenv import load_dotenv
from db_async import execute, close_pool

load_dotenv()

async def cleanup(start_date_str, end_date_str, keep_newest=False):
    start_date = datetime.strptime(start_date_str, '%d-%m-%Y').date()
    end_date = datetime.strptime(end_date_str, '%d-%m-%Y').date()

    # 1. Get Sitting IDs for the date range
    sitting_query = """
    SELECT id, date 
    FROM sittings 
    WHERE date >= $1 AND date <= $2
    """
    sittings = await execute(sitting_query, start_date, end_date, fetch=True)
    sitting_ids = [str(row['id']) for row in sittings]
    
    if not sittings:
        print(f"No sittings found in range {start_date_str} to {end_date_str}.")
        return

    print(f"Cleaning duplicates in {len(sittings)} sittings...")
    
    # 2. De-duplicate using a single SQL command
    # We identify duplicates by (sitting_id, section_title, section_type)
    # We keep the one with the oldest created_at (or just pick one if timestamps are identical)
    
    cleanup_query = f"""
    WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY sitting_id, section_title, section_type 
                   ORDER BY created_at {'DESC' if keep_newest else 'ASC'}, id ASC
               ) as rnum
        FROM sections
        WHERE sitting_id = ANY($1::uuid[])
    )
    DELETE FROM sections
    WHERE id IN (
        SELECT id FROM duplicates WHERE rnum > 1
    );
    """
    
    print("Executing cleanup query...")
    status = await execute(cleanup_query, sitting_ids)
    
    print(f"Cleanup complete. DB Status: {status}")
    await close_pool()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: uv run cleanup_duplicates.py START_DATE [END_DATE] [--keep-newest]")
        print("Example: uv run cleanup_duplicates.py 22-09-2025")
        sys.exit(1)
    
    args = sys.argv[1:]
    dates = [arg for arg in args if not arg.startswith('--')]

    start = dates[0]
    end = dates[1] if len(dates) > 1 else start
    keep_newest = "--keep-newest" in args
    
    asyncio.run(cleanup(start, end, keep_newest))
