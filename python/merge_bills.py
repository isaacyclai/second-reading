
import asyncio
import os
from dotenv import load_dotenv
from db_async import execute

load_dotenv()

async def merge():
    print("Merging duplicate bills...")
    
    # 1. Find duplicated groups
    # Group by normalized title
    query = """
    SELECT lower(trim(b.title)) as key, array_agg(b.id) as ids
    FROM bills b
    GROUP BY lower(trim(b.title))
    HAVING COUNT(*) > 1
    """
    
    groups = await execute(query, fetch=True)
    
    if not groups:
        print("No duplicate bills found to merge.")
        return

    print(f"Found {len(groups)} sets of duplicates.")
    
    merged_count = 0
    deleted_count = 0
    
    for g in groups:
        ids = g['ids'] # List of UUIDs
        
        # Get detailed info for all bills in this group to decide which to keep
        # We want to keep the one with the most sections, or the oldest one
        details_query = """
        SELECT b.id, b.title, b.summary, b.ministry_id,
               (SELECT COUNT(*) FROM sections WHERE bill_id = b.id) as section_count,
               b.created_at
        FROM bills b
        WHERE b.id = ANY($1::uuid[])
        ORDER BY section_count DESC, created_at ASC
        """
        
        candidates = await execute(details_query, ids, fetch=True)
        
        if not candidates:
            continue
            
        master = candidates[0]
        duplicates = candidates[1:]
        
        print(f"Merge Group: '{master['title']}'")
        print(f"  Keeping: {master['id']} (Sections: {master['section_count']})")
        
        dup_ids = [d['id'] for d in duplicates]
        print(f"  Merging {len(dup_ids)} duplicates: {dup_ids}")
        
        # 2. Update sections to point to master
        # (Even if duplicate has 0 sections, this is safe)
        if dup_ids:
            move_query = """
            UPDATE sections 
            SET bill_id = $1 
            WHERE bill_id = ANY($2::uuid[])
            """
            await execute(move_query, master['id'], dup_ids)
            
            # 3. Delete duplicates
            del_query = """
            DELETE FROM bills 
            WHERE id = ANY($1::uuid[])
            """
            await execute(del_query, dup_ids)
            
            merged_count += 1
            deleted_count += len(dup_ids)
            print("  Done.")

    print("-" * 50)
    print(f"Merge Complete. Merged {merged_count} groups, deleted {deleted_count} duplicate records.")

if __name__ == "__main__":
    asyncio.run(merge())
