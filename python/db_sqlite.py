"""
SQLite database module for Parliament Summarizer.
Synchronous operations using Python's built-in sqlite3.
"""
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

# Default database path (can be overridden via environment variable)
DEFAULT_DB_PATH = Path(__file__).parent.parent / 'data' / 'parliament.db'
DB_PATH = os.getenv('PARLIAMENT_DB_PATH', str(DEFAULT_DB_PATH))

# Global connection (reused for performance)
_conn = None


def get_connection() -> sqlite3.Connection:
    """Get or create a database connection."""
    global _conn
    if _conn is None:
        # Ensure directory exists
        db_path = Path(DB_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)

        _conn = sqlite3.connect(DB_PATH)
        _conn.row_factory = sqlite3.Row  # Enable dict-like access
        _conn.execute('PRAGMA foreign_keys = ON')
        _conn.execute('PRAGMA journal_mode = WAL')  # Better concurrent access
    return _conn


def close_connection():
    """Close the database connection."""
    global _conn
    if _conn:
        _conn.close()
        _conn = None


def init_db():
    """Initialize the database with schema."""
    conn = get_connection()
    schema_path = Path(__file__).parent / 'schema.sql'

    with open(schema_path, 'r') as f:
        schema = f.read()

    conn.executescript(schema)
    conn.commit()
    print(f"Database initialized at {DB_PATH}")


def generate_id() -> str:
    """Generate a UUID string for use as primary key."""
    return str(uuid.uuid4())


def parse_date(date_str: str) -> str:
    """Convert DD-MM-YYYY to YYYY-MM-DD (ISO format for SQLite)."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, '%d-%m-%Y')
        return dt.strftime('%Y-%m-%d')
    except ValueError:
        # Already in ISO format or invalid
        return date_str


def find_or_create_member(name: str) -> str:
    """Find existing member or create new one. Returns member ID."""
    conn = get_connection()
    cursor = conn.cursor()

    # Try to find existing
    cursor.execute('SELECT id FROM members WHERE name = ?', (name,))
    row = cursor.fetchone()

    if row:
        return row['id']

    # Create new
    member_id = generate_id()
    cursor.execute(
        'INSERT INTO members (id, name) VALUES (?, ?)',
        (member_id, name)
    )
    conn.commit()
    return member_id


def find_ministry_by_acronym(acronym: str) -> str:
    """Find ministry ID by acronym. Returns None if not found."""
    if not acronym:
        return None

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM ministries WHERE acronym = ?', (acronym,))
    row = cursor.fetchone()
    return row['id'] if row else None


def find_or_create_bill(title: str, ministry_id: str = None,
                        first_reading_date: str = None,
                        first_reading_session_id: str = None) -> str:
    """Find existing bill or create new one. Returns bill ID."""
    conn = get_connection()
    cursor = conn.cursor()

    # Try to find existing by title
    cursor.execute(
        'SELECT id, first_reading_date, ministry_id FROM bills WHERE title = ?',
        (title,)
    )
    row = cursor.fetchone()

    if row:
        bill_id = row['id']
        existing_ministry = row['ministry_id']
        existing_first_reading = row['first_reading_date']

        # Update ministry if not set
        if ministry_id and not existing_ministry:
            cursor.execute(
                'UPDATE bills SET ministry_id = ? WHERE id = ?',
                (ministry_id, bill_id)
            )

        # Update first reading info if not set
        if first_reading_date and not existing_first_reading:
            cursor.execute(
                '''UPDATE bills SET first_reading_date = ?, first_reading_session_id = ?
                   WHERE id = ?''',
                (parse_date(first_reading_date), first_reading_session_id, bill_id)
            )

        conn.commit()
        return bill_id

    # Create new bill
    bill_id = generate_id()
    cursor.execute(
        '''INSERT INTO bills (id, title, ministry_id, first_reading_date, first_reading_session_id)
           VALUES (?, ?, ?, ?, ?)''',
        (bill_id, title, ministry_id, parse_date(first_reading_date), first_reading_session_id)
    )
    conn.commit()
    return bill_id


def create_or_update_session(date_str: str, sitting_no: int = None,
                              parliament: int = None, session_no: int = None,
                              volume_no: int = None, format_type: str = None,
                              url: str = None) -> str:
    """Create or update a session. Returns session ID."""
    conn = get_connection()
    cursor = conn.cursor()

    iso_date = parse_date(date_str)

    # Check if session exists
    cursor.execute('SELECT id FROM sessions WHERE date = ?', (iso_date,))
    row = cursor.fetchone()

    if row:
        session_id = row['id']
        # Update existing
        cursor.execute(
            '''UPDATE sessions SET sitting_no = ?, parliament = ?, session_no = ?,
               volume_no = ?, format = ?, url = ? WHERE id = ?''',
            (sitting_no, parliament, session_no, volume_no, format_type, url, session_id)
        )
    else:
        # Create new
        session_id = generate_id()
        cursor.execute(
            '''INSERT INTO sessions (id, date, sitting_no, parliament, session_no, volume_no, format, url)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (session_id, iso_date, sitting_no, parliament, session_no, volume_no, format_type, url)
        )

    conn.commit()
    return session_id


def add_session_attendance(session_id: str, member_id: str, present: bool = True,
                           constituency: str = None, designation: str = None):
    """Add or update session attendance record."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''INSERT INTO session_attendance (session_id, member_id, present, constituency, designation)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (session_id, member_id) DO UPDATE SET
           present = excluded.present,
           constituency = excluded.constituency,
           designation = excluded.designation''',
        (session_id, member_id, 1 if present else 0, constituency, designation)
    )
    conn.commit()


def create_section(session_id: str, category: str, section_type: str,
                   title: str, content_html: str, content_plain: str,
                   section_order: int, source_url: str = None,
                   ministry_id: str = None, bill_id: str = None) -> str:
    """Create a new section. Returns section ID."""
    conn = get_connection()
    cursor = conn.cursor()

    section_id = generate_id()
    cursor.execute(
        '''INSERT INTO sections
           (id, session_id, ministry_id, bill_id, category, section_type,
            section_title, content_html, content_plain, section_order, source_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (section_id, session_id, ministry_id, bill_id, category, section_type,
         title, content_html, content_plain, section_order, source_url)
    )
    conn.commit()
    return section_id


def add_section_speaker(section_id: str, member_id: str,
                        constituency: str = None, designation: str = None):
    """Add a speaker to a section."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''INSERT INTO section_speakers (section_id, member_id, constituency, designation)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (section_id, member_id) DO NOTHING''',
        (section_id, member_id, constituency, designation)
    )
    conn.commit()


def get_session_count() -> int:
    """Get total number of sessions in database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM sessions')
    return cursor.fetchone()['count']


def get_member_count() -> int:
    """Get total number of members in database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM members')
    return cursor.fetchone()['count']


def get_section_count() -> int:
    """Get total number of sections in database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM sections')
    return cursor.fetchone()['count']


def get_bill_count() -> int:
    """Get total number of bills in database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as count FROM bills')
    return cursor.fetchone()['count']


if __name__ == '__main__':
    # Initialize database and show stats
    init_db()
    print(f"\nDatabase stats:")
    print(f"  Sessions: {get_session_count()}")
    print(f"  Members: {get_member_count()}")
    print(f"  Sections: {get_section_count()}")
    print(f"  Bills: {get_bill_count()}")
    close_connection()
