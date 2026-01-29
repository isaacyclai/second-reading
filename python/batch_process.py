import asyncio
import re
import os
import sys
import logging
from datetime import datetime, timedelta
from openai import AsyncOpenAI
from dotenv import load_dotenv

from hansard_api import HansardAPI
from db_async import (
    execute, fetchone, find_or_create_member, find_ministry_by_acronym,
    add_section_speaker, add_session_attendance, find_or_create_bill,
    refresh_member_list_view, close_pool
)
from parliament_session import BILL_TYPES

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Constants
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
PARALLEL_REQUESTS = 3
DB_SEMAPHORE = asyncio.Semaphore(10) # Limit concurrent DB operations
AI_SEMAPHORE = asyncio.Semaphore(1)  # Sequential AI requests for rate limiting
AI_COOLDOWN = 2.5                    # Delay in seconds to achieve ~24-30 RPM and respect TPM

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


async def generate_summary(text: str, prompt_template: str, model='llama-3.1-8b-instant') -> str:
    if not text:
        return None
        
    async with AI_SEMAPHORE:
        client = AsyncOpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=GROQ_API_KEY,
        )
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "user", "content": prompt_template.format(text=text)}
                ],
            )
            # Add delay to respect 30 RPM limit
            await asyncio.sleep(AI_COOLDOWN)
            
            content = response.choices[0].message.content.strip()
            # Normalize whitespace: replace multiple spaces/tabs/non-breaking spaces 
            # with single space but preserve newlines
            content = re.sub(r'[ \t\xa0]+', ' ', content)
            return content
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            # Still wait on error to avoid rapid-fire failures hitting limits
            await asyncio.sleep(AI_COOLDOWN)
            return None

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
    # Detect ministry
    ministry_acronym = detect_ministry(section)
    ministry_id = await find_ministry_by_acronym(ministry_acronym) if ministry_acronym else None
    
    # Handle Bill
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

    # Insert section
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
    
    # Add speakers
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

# --- Summary Generation Functions ---

async def generate_section_summaries_for_session(session_id):
    sections = await execute(
        '''SELECT id, section_title, content_plain, category, section_type 
           FROM sections 
           WHERE session_id = $1 AND summary IS NULL AND length(content_plain) > 20''',
        session_id,
        fetch=True
    )
    
    if not sections:
        return
        
    logger.info(f"Generating summaries for {len(sections)} sections in session {session_id}")
    
    tasks = []
    for s in sections:
        if s['category'] == 'question':
            tasks.append(generate_question_summary(s))
        else:
            tasks.append(generate_section_summary(s))
        
        # Batch to avoid hitting rate limits too hard
        if len(tasks) >= 5:
            await asyncio.gather(*tasks)
            tasks = []
            
    if tasks:
        await asyncio.gather(*tasks)

async def generate_question_summary(section):
    """Specialized summary for Parliamentary Questions."""
    prompt = """You are summarizing a Parliamentary Question from the Singapore Parliament hansard.
    Title: {title}
    
    Content:
    {text}
    
    Write a concise 5-line summary, that begins with "This question concerns...". Mention the question 
    raised by the MP and the key points of the Minister's response. Focus on facts and policy details.

    DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt.
    """
    
    summary = await generate_summary(
        section['content_plain'][:20000], 
        prompt.replace('{title}', section['section_title'])
    )
    
    if summary:
        await execute('UPDATE sections SET summary = $1 WHERE id = $2', summary, section['id'])

async def generate_section_summary(section):
    prompt = """You are summarizing a section (Motion, Statement, or Clarification) from the Singapore Parliament hansard.
    Title: {title}
    
    Content:
    {text}
    
    Write a concise 5-line summary of the key points discussed, arguments raised, and any conclusions or decisions reached.
    Begin with "This motion/statement/clarification/etc. concerns..."

    DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt.
    """
    
    summary = await generate_summary(
        section['content_plain'][:20000], 
        prompt.replace('{title}', section['section_title'])
    )
    
    if summary:
        await execute('UPDATE sections SET summary = $1 WHERE id = $2', summary, section['id'])


async def generate_bill_summaries_for_session(session_id):
    bills = await execute(
        '''SELECT DISTINCT b.id, b.title 
           FROM bills b
           JOIN sections s ON b.id = s.bill_id
           WHERE s.session_id = $1''',
        session_id,
        fetch=True
    )
    
    if not bills:
        return
        
    logger.info(f"Generating summaries for {len(bills)} bills in session {session_id}")
    
    for bill in bills:
        # Get all readings/debates for this bill
        sections = await execute(
            '''SELECT content_plain FROM sections 
               WHERE bill_id = $1 
               ORDER BY section_order''',
            bill['id'],
            fetch=True
        )
        
        if not sections:
            continue
            
        full_text = "\n\n".join([s['content_plain'] for s in sections])
        
        # Skip if text is too short
        if len(full_text) < 500:
            continue
        
        prompt = """You are summarizing a debate on a bill from the Singapore Parliament hansard.
        Title: {title}
        
        Content:
        {text}
        
        Write a concise summary of the key points discussed in this section. Do not just reproduce what the questions and answers are. 
        
        Return strictly 3 bullet points in the following Markdown format:
        
        - **Purpose**: Brief description of the bill's purpose.
        
        - **Key Concerns raised by MPs**: Brief description of the key concerns raised by MPs.
        
        - **Minister's Responses**: Brief description of the Minister's responses and justifications.

        Rules:
        1. Always use bold for the title of each point.
        2. Ensure there is a blank line between each bullet point.
        3. Do not include any intro or outro text.
        4. DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt.
        """
        
        summary = await generate_summary(
            full_text[:100000], # Limit context window just in case
            prompt.replace('{title}', bill['title'])
        )
        
        if summary:
            await execute('UPDATE bills SET summary = $1 WHERE id = $2', summary, bill['id'])
            logger.info(f"Generated summary for bill {bill['title']}")

async def generate_member_summaries():
    logger.info("Generating member summaries...")

    members = await execute('SELECT id, name FROM members', fetch=True)
    
    tasks = []
    
    async def process_member(member):
        activity = await execute(
            '''SELECT s.section_title, s.section_type, m.acronym as ministry,
                      ss.designation, sess.date
               FROM section_speakers ss
               JOIN sections s ON ss.section_id = s.id
               JOIN sessions sess ON s.session_id = sess.id
               LEFT JOIN ministries m ON s.ministry_id = m.id
               WHERE ss.member_id = $1
               ORDER BY sess.date DESC
               LIMIT 20''',
            member['id'],
            fetch=True
        )
            
        if not activity:
            return
            
        activity_lines = []
        recent_designation = activity[0]['designation'] or "MP"
        
        for a in activity:
            ministry = f"[{a['ministry']}] " if a['ministry'] else ""
            activity_lines.append(f"- {a['date']}: {ministry}{a['section_title']}")
        
        context = "\n".join(activity_lines)
        
        prompt = f"""Based on the recent parliamentary questions/statements by {member['name']} ({recent_designation}), provide a summary of their key focus areas.
        
        Recent Activity (Last 20 items):
        {{text}}
        
        Identify the 3 general topics most representative of their involvement. Return strictly 3 bullet points in the following Markdown format:
        
        - **Topic Title**: Brief description of the questions raised without mentioning the member's name or role.
        
        - **Another Topic**: Another description...
        
        - **Final Topic**: Final description...
        
        Rules:
        1. Always use bold for the topic title.
        2. Ensure there is a blank line between each bullet point.
        3. Do NOT mention the member's name, "the MP", "the member", or their designation in the descriptions. Focus ONLY on the issues.
        4. Group related questions under general topics (e.g., "Public Transport" instead of specific bus routes).
        5. Do not include any intro or outro text.
        6. DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt.
        """
        
        summary = await generate_summary(context, prompt, model='llama-3.1-8b-instant')
        
        if summary:
            await execute(
                '''INSERT INTO member_summaries (member_id, summary, last_updated)
                   VALUES ($1, $2, NOW())
                   ON CONFLICT (member_id) DO UPDATE SET summary = EXCLUDED.summary, last_updated = NOW()''',
                member['id'], summary
            )
    
    for m in members:
        tasks.append(process_member(m))
        
        # Batch concurrent requests
        if len(tasks) >= 5:
            await asyncio.gather(*tasks)
            tasks = []
            
    if tasks:
        await asyncio.gather(*tasks)
    logger.info("Member summaries complete")


async def batch_process(start_date_str, end_date_str, no_summaries=False, only_summaries=False, only_blank_summaries=False, summarize_members=False):
    start_date = datetime.strptime(start_date_str, '%d-%m-%Y')
    end_date = datetime.strptime(end_date_str, '%d-%m-%Y')
    
    dates = []
    curr = start_date
    while curr <= end_date:
        dates.append(curr.strftime('%d-%m-%Y'))
        curr += timedelta(days=1)
        
    logger.info(f"Checking date range: {start_date_str} to {end_date_str} ({len(dates)} days)")
    
    ingested_session_ids = []
    
    # 1. Ingest Data (Parallel chunks)
    if not (only_summaries or only_blank_summaries or summarize_members):
        # Process in chunks to be polite to the Hansard API
        chunk_size = 5
        for i in range(0, len(dates), chunk_size):
            chunk = dates[i:i+chunk_size]
            tasks = [ingest_session(d) for d in chunk]
            results = await asyncio.gather(*tasks)
            
            for sid in results:
                if sid:
                    ingested_session_ids.append(sid)
                    
            await asyncio.sleep(1) # Gentle delay between chunks
            
    # 2. Refresh Read Views (needs to happen before summary generation for members)
    await refresh_member_list_view()
    
    # 3. Generate Summaries
    if not no_summaries:
        # If summaries_only is True, we need to fetch relevant session IDs
        session_ids_to_process = ingested_session_ids
        
        if not summarize_members:
            if only_summaries:
                # Fetch sessions in date range
                rows = await execute(
                'SELECT id FROM sessions WHERE date >= TO_DATE($1, \'DD-MM-YYYY\') AND date <= TO_DATE($2, \'DD-MM-YYYY\')',
                start_date_str, end_date_str,
            fetch=True
            )
            elif only_blank_summaries:
                rows = await execute(
                    '''
                    SELECT DISTINCT s.id 
                    FROM sessions s
                    JOIN sections sec ON s.id = sec.session_id
                    WHERE s.date >= TO_DATE($1, 'DD-MM-YYYY') 
                    AND s.date <= TO_DATE($2, 'DD-MM-YYYY')
                    AND (sec.summary IS NULL)
                    ''',
                    start_date_str, end_date_str,
                    fetch=True
                )
            session_ids_to_process = [r['id'] for r in rows]
                
            logger.info(f"Generating summaries for {len(session_ids_to_process)} sessions...")
            
            # A. Section & Bill Summaries
            for sid in session_ids_to_process:
                await generate_section_summaries_for_session(sid)
                await generate_bill_summaries_for_session(sid)
        
        # D. Member Summaries
        else:
            await generate_member_summaries()

    logger.info("Batch processing complete!")
    await close_pool()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python batch_process.py START_DATE [END_DATE] [--no-summaries | --only-summaries | --only-blank-summaries | --summarize-members]")
        print("Example: python batch_process.py 01-10-2024")
        sys.exit(1)
        
    # Separate dates and flags
    args = sys.argv[1:]
    dates = [arg for arg in args if not arg.startswith('--')]
    flags = [arg for arg in args if arg.startswith('--')]
    
    if not dates:
        print("Error: Start date required")
        sys.exit(1)
        
    start = dates[0]
    end = dates[1] if len(dates) > 1 else start
    
    skip_sum = '--no-summaries' in flags
    sum_only = '--only-summaries' in flags
    blank_sum = '--only-blank-summaries' in flags
    do_members = '--summarize-members' in flags
    
    asyncio.run(batch_process(start, end, skip_sum, sum_only, blank_sum, do_members))
