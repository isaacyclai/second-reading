import os
import asyncio
import asyncpg
from dotenv import load_dotenv

load_dotenv()

# Global connection pool
_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            os.getenv('DATABASE_URL'),
            min_size=5,
            max_size=20,
            statement_cache_size=0
        )
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

async def execute(query, *args, fetch=False):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if fetch:
            return await conn.fetch(query, *args)
        else:
            return await conn.execute(query, *args)

async def fetchone(query, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)

async def find_or_create_member(name):
    pool = await get_pool()
    async with pool.acquire() as conn:
        # Try to find existing
        row = await conn.fetchrow(
            'SELECT id FROM members WHERE name = $1', name
        )
        if row:
            return row['id']
        
        # Create new
        row = await conn.fetchrow(
            'INSERT INTO members (name) VALUES ($1) RETURNING id', name
        )
        return row['id']

async def find_ministry_by_acronym(acronym):
    if not acronym:
        return None
    row = await fetchone('SELECT id FROM ministries WHERE acronym = $1', acronym)
    return row['id'] if row else None

async def find_or_create_bill(title, ministry_id=None, first_reading_date=None, first_reading_sitting_id=None):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            'SELECT id, first_reading_date, ministry_id FROM bills WHERE title = $1',
            title
        )
        
        if row:
            bill_id = row['id']
            existing_ministry = row['ministry_id']
            existing_first_reading = row['first_reading_date']
            
            # Update ministry if not set
            if ministry_id and not existing_ministry:
                await conn.execute(
                    'UPDATE bills SET ministry_id = $1 WHERE id = $2',
                    ministry_id, bill_id
                )
            
            # Update first reading info if not set
            if first_reading_date and not existing_first_reading:
                await conn.execute(
                    '''UPDATE bills SET first_reading_date = TO_DATE($1, 'DD-MM-YYYY'), 
                       first_reading_sitting_id = $2
                       WHERE id = $3''',
                    first_reading_date, first_reading_sitting_id, bill_id
                )
            return bill_id
        
        # Create new bill
        row = await conn.fetchrow(
            '''INSERT INTO bills (title, ministry_id, first_reading_date, first_reading_sitting_id)
               VALUES ($1, $2, TO_DATE($3, 'DD-MM-YYYY'), $4) RETURNING id''',
            title, ministry_id, first_reading_date, first_reading_sitting_id
        )
        return row['id']

async def add_section_speaker(section_id, member_id, constituency=None, designation=None):
    await execute(
        '''INSERT INTO section_speakers (section_id, member_id, constituency, designation)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (section_id, member_id) DO NOTHING''',
        section_id, member_id, constituency, designation
    )

async def add_sitting_attendance(sitting_id, member_id, present=True, constituency=None, designation=None):
    await execute(
        '''INSERT INTO sitting_attendance (sitting_id, member_id, present, constituency, designation)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (sitting_id, member_id) DO UPDATE SET
           present = EXCLUDED.present,
           constituency = EXCLUDED.constituency,
           designation = EXCLUDED.designation''',
        sitting_id, member_id, present, constituency, designation
    )


if __name__ == '__main__':
    async def test():
        result = await fetchone('SELECT NOW() as now')
        print(f'Connected! Current time: {result["now"]}')
        await close_pool()
    
    asyncio.run(test())
