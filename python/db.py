import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return psycopg2.connect(os.getenv('DATABASE_URL'))

def execute_query(query, params=None, fetch=False):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query, params)
    
    result = None
    if fetch:
        result = cur.fetchall()
    
    conn.commit()
    cur.close()
    conn.close()
    return result

def find_or_create_member(name):
    result = execute_query(
        'SELECT id FROM members WHERE name = %s',
        (name,),
        fetch=True
    )
    
    if result:
        return result[0]['id']
    
    result = execute_query(
        'INSERT INTO members (name) VALUES (%s) RETURNING id',
        (name,),
        fetch=True
    )
    return result[0]['id']

def find_ministry_by_acronym(acronym):
    result = execute_query(
        'SELECT id FROM ministries WHERE acronym = %s',
        (acronym,),
        fetch=True
    )
    return result[0]['id'] if result else None

def add_section_speaker(section_id, member_id, constituency=None, designation=None):
    execute_query(
        '''INSERT INTO section_speakers (section_id, member_id, constituency, designation)
           VALUES (%s, %s, %s, %s)''',
        (section_id, member_id, constituency, designation)
    )

def add_session_attendance(session_id, member_id, present=True, constituency=None, designation=None):
    execute_query(
        '''INSERT INTO session_attendance (session_id, member_id, present, constituency, designation)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (session_id, member_id) DO UPDATE SET
           present = EXCLUDED.present,
           constituency = EXCLUDED.constituency,
           designation = EXCLUDED.designation''',
        (session_id, member_id, present, constituency, designation)
    )

if __name__ == '__main__':
    try:
        result = execute_query('SELECT NOW()', fetch=True)
        print('Connected to Supabase')
        print(f'Current time: {result[0]["now"]}')
        
        moh = find_ministry_by_acronym('MOH')
        print(f'MOH ministry id: {moh}')
    except Exception as e:
        print(f'Connection failed: {e}')