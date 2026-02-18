import asyncio
import sys
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv

from hansard_api import HansardAPI
from db_async import (
    fetchone, find_or_create_member, find_ministry_by_acronym,
    add_section_speaker, add_session_attendance, find_or_create_bill,
    close_pool
)
from parliament_session import BILL_TYPES

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

DB_SEMAPHORE = asyncio.Semaphore(10) # Limit concurrent DB operations
DESIGNATION_TO_MINISTRY = {
    'Minister in the Prime Minister\'s Office': 'PMO',
    'Minister for Culture, Community and Youth': 'MCCY',
    'Minister for Defence': 'MINDEF',
    'Minister for Digital Development and Information': 'MDDI',
    'Minister for Education': 'MOE',
    'Minister for Finance': 'MOF',
    'Minister for Foreign Affairs': 'MFA',
    'Minister for Health': 'MOH',
    'Minister for Home Affairs': 'MHA',
    'Minister for Law': 'MINLAW',
    'Minister for Manpower': 'MOM',
    'Minister for National Development': 'MND',
    'Minister for Social and Family Development': 'MSF',
    'Minister for Sustainability and the Environment': 'MSE',
    'Minister for Trade and Industry': 'MTI',
    'Minister for Transport': 'MOT',
}

def detect_ministry_from_designation(designation):
    if not designation:
        return None
    designation_lower = designation.lower()
    for keyword, acronym in DESIGNATION_TO_MINISTRY.items():
        if keyword in designation_lower:
            return acronym
    return None

def detect_ministry_from_content(content_plain):
    if not content_plain:
        return None
    
    # Look in the first 500 chars (the question preamble)
    preamble = content_plain[:500]
    
    # Search for each ministry designation in the content
    for designation, acronym in DESIGNATION_TO_MINISTRY.items():
        if designation in preamble:
            return acronym
    
    return None

def detect_ministry_from_speakers(speakers):
    for speaker in speakers:
        designation = getattr(speaker, 'appointment', None)
        if designation and 'minister' in designation.lower():
            ministry = detect_ministry_from_designation(designation)
            if ministry:
                return ministry
    return None

def detect_ministry(section):
    # Try content-based detection first (more accurate)
    ministry = detect_ministry_from_content(section.get('content_plain', ''))
    if ministry:
        return ministry
    
    # Fallback to speaker designation
    return detect_ministry_from_speakers(section.get('speakers', []))

async def ingest_session(date_str: str) -> str:
    logger.info(f"Processing session for {date_str}...")
    
    # Run synchronous API fetch in executor
    loop = asyncio.get_event_loop()
    api = HansardAPI()
    parliament_session = await loop.run_in_executor(None, lambda: api.fetch_by_date(date_str))
    
    if not parliament_session:
        logger.info(f"No data found for {date_str}")
        return None
        
    sections = parliament_session.get_sections()
    metadata = parliament_session.get_metadata()
    
    if not sections:
        logger.info(f"No sections found for {date_str}")
        return None
        
    # Create/Update Session
    session_url = f"https://sprs.parl.gov.sg/search/#/fullreport?sittingdate={date_str}"
    
    # Helper to clean None values for SQL
    def mkval(v): return v if v is not None else None
    
    # 2. Insert Session
    row = await fetchone(
        '''INSERT INTO sessions (date, sitting_no, parliament, session_no, volume_no, format, url)
           VALUES (TO_DATE($1, 'DD-MM-YYYY'), $2, $3, $4, $5, $6, $7)
           ON CONFLICT (date) DO UPDATE SET sitting_no = EXCLUDED.sitting_no
           RETURNING id''',
        metadata.get('date'),
        mkval(metadata.get('sitting_no')),
        mkval(metadata.get('parliament')),
        mkval(metadata.get('session_no')),
        mkval(metadata.get('volume_no')),
        mkval(metadata.get('format')),
        session_url
    )
    session_id = row['id']
    logger.info(f"   Session ID: {session_id}")
    
    # 3. Save Attendance (Concurrent)
    attendance_tasks = []
    
    for mp in parliament_session.present_members:
        attendance_tasks.append(process_attendance(session_id, mp, True))
    
    for mp in parliament_session.absent_members:
        attendance_tasks.append(process_attendance(session_id, mp, False))
        
    logger.info(f"   Saving attendance for {len(attendance_tasks)} members...")
    await asyncio.gather(*attendance_tasks)
    logger.info(f"   Attendance saved for session {session_id}")
    
    # 4. Save Sections
    section_tasks = []
    chunk_size = 20
    sections = parliament_session.get_sections()
    logger.info(f"   Processing {len(sections)} sections...")
    
    for i in range(0, len(sections), chunk_size):
         chunk = sections[i:i + chunk_size]
         chunk_tasks = []
         for idx, section in enumerate(chunk):
             # Adjust index to be global
             global_idx = i + idx
             chunk_tasks.append(process_section(session_id, global_idx, section, metadata.get('date')))
         
         logger.info(f"     Processing chunk {i}-{i+len(chunk)}...")
         chunk_results = await asyncio.gather(*chunk_tasks)
         if chunk_results:
             section_tasks.extend(chunk_results)
             
    section_ids = section_tasks
    
    logger.info(f"   processed {len(section_ids)} sections for {date_str}")
    return session_id

async def process_attendance(session_id, mp, present):
    async with DB_SEMAPHORE:
        member_id = await find_or_create_member(mp.name)
        await add_session_attendance(
            session_id=session_id, 
            member_id=member_id, 
            present=present,
            constituency=mp.constituency,
            designation=mp.appointment
        )

async def process_section(session_id, idx, section, date_str):
    # Adjournment motions are raised by individual MPs on any topic;
    # the answering minister is incidental, so skip ministry tagging.
    if section.get("category") == "adjournment_motion":
        ministry_id = None
    else:
        ministry_acronym = detect_ministry(section)
        ministry_id = await find_ministry_by_acronym(ministry_acronym) if ministry_acronym else None
    
    bill_id = None
    section_type = section['section_type']
    
    if section_type in BILL_TYPES:
        first_reading_date = date_str if section_type == 'BI' else None
        first_reading_session_id = session_id if section_type == 'BI' else None
        
        bill_id = await find_or_create_bill(
            title=section['title'],
            ministry_id=ministry_id,
            first_reading_date=first_reading_date,
            first_reading_session_id=first_reading_session_id
        )

    async with DB_SEMAPHORE:
        row = await fetchone(
            '''INSERT INTO sections 
           (session_id, ministry_id, bill_id, category, section_type, section_title, 
            content_html, content_plain, section_order, source_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id''',
            session_id,
            ministry_id,
            bill_id,
            section.get('category', 'other'),
            section['section_type'],
            section['title'],
            section['content_html'],
            section['content_plain'],
            section['order'],
            section.get('source_url')
        )
        section_id = row['id']
    
    speaker_tasks = []
    for speaker in section['speakers']:
        speaker_tasks.append(process_speaker(section_id, speaker))
    
    if speaker_tasks:
        await asyncio.gather(*speaker_tasks)
        
    return section_id

async def process_speaker(section_id, speaker):
    async with DB_SEMAPHORE:
        member_id = await find_or_create_member(speaker.name)
        await add_section_speaker(
            section_id=section_id,
            member_id=member_id,
            constituency=getattr(speaker, 'constituency', None),
            designation=getattr(speaker, 'appointment', None)
        )

async def batch_process(start_date_str, end_date_str):
    start_date = datetime.strptime(start_date_str, '%d-%m-%Y')
    end_date = datetime.strptime(end_date_str, '%d-%m-%Y')
    
    dates = []
    curr = start_date
    while curr <= end_date:
        dates.append(curr.strftime('%d-%m-%Y'))
        curr += timedelta(days=1)
        
    logger.info(f"Checking date range: {start_date_str} to {end_date_str} ({len(dates)} days)")
    
    ingested_session_ids = []
    
    chunk_size = 5
    for i in range(0, len(dates), chunk_size):
        chunk = dates[i:i+chunk_size]
        tasks = [ingest_session(d) for d in chunk]
        results = await asyncio.gather(*tasks)
        
        for sid in results:
            if sid:
                ingested_session_ids.append(sid)
                
        await asyncio.sleep(1)

    logger.info("Batch processing complete!")
    await close_pool()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: uv run batch_process.py START_DATE [END_DATE]")
        print("Example: uv run batch_process.py 01-10-2024")
        sys.exit(1)
        
    args = sys.argv[1:]
    dates = [arg for arg in args if not arg.startswith('--')]
    
    if not dates:
        print("Error: Start date required")
        sys.exit(1)
        
    start = dates[0]
    end = dates[1] if len(dates) > 1 else start
    
    asyncio.run(batch_process(start, end))
