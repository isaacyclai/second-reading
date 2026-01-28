import re
import sys

from db import execute_query, find_or_create_member, find_ministry_by_acronym, add_section_speaker, add_session_attendance, find_or_create_bill, refresh_member_list_view
from hansard_api import HansardAPI

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
    """Extract ministry by searching for full ministry titles in the question preamble."""
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
    """Fallback: detect ministry from speaker's designation."""
    for speaker in speakers:
        designation = getattr(speaker, 'appointment', None)
        if designation and 'minister' in designation.lower():
            ministry = detect_ministry_from_designation(designation)
            if ministry:
                return ministry
    return None

def detect_ministry(section):
    """Detect ministry - first from content text, then fallback to speakers."""
    # Try content-based detection first (more accurate)
    ministry = detect_ministry_from_content(section.get('content_plain', ''))
    if ministry:
        return ministry
    
    # Fallback to speaker designation
    return detect_ministry_from_speakers(section.get('speakers', []))

def process_hansard_by_date(date_str: str): 
    print(f'Processing Hansard for {date_str}')
    
    api = HansardAPI()
    
    # 1. Fetch from API
    print('1. Fetching from API...')
    parliament_session = api.fetch_by_date(date_str)
    
    if not parliament_session:
        print('No data found for this date')
        return
    
    sections = parliament_session.get_sections()
    metadata = parliament_session.get_metadata()
    print(f'   Found {len(sections)} question sections')

    if not sections:
        print('No question sections to process')
        return
    
    # 2. Create session
    print('2. Creating session in Supabase...')
    session_url = f"https://sprs.parl.gov.sg/search/#/fullreport?sittingdate={date_str}"
    session_result = execute_query(
        '''INSERT INTO sessions (date, sitting_no, parliament, session_no, volume_no, format, url)
           VALUES (TO_DATE(%s, 'DD-MM-YYYY'), %s, %s, %s, %s, %s, %s)
           ON CONFLICT (date) DO UPDATE SET sitting_no = EXCLUDED.sitting_no
           RETURNING id''',
        (
            metadata.get('date'),
            metadata.get('sitting_no'),
            metadata.get('parliament'),
            metadata.get('session_no'),
            metadata.get('volume_no'),
            metadata.get('format'),
            session_url
        ),
        fetch=True
    )
    session_id = session_result[0]['id']
    print(f'   Session ID: {session_id}')
    
    # 3. Save attendance
    print('3. Saving attendance...')
    present_count = 0
    absent_count = 0
    
    for mp in parliament_session.present_members:
        member_id = find_or_create_member(mp.name)
        add_session_attendance(
            session_id=session_id,
            member_id=member_id,
            present=True,
            constituency=mp.constituency,
            designation=mp.appointment
        )
        present_count += 1
    
    for mp in parliament_session.absent_members:
        member_id = find_or_create_member(mp.name)
        add_session_attendance(
            session_id=session_id,
            member_id=member_id,
            present=False,
            constituency=mp.constituency,
            designation=mp.appointment
        )
        absent_count += 1
    
    print(f'   Present: {present_count}, Absent: {absent_count}')
    
    # 4. Process each section
    print('4. Inserting sections...')
    processed = 0

    for idx, section in enumerate(sections):
        speakers = section['speakers']
        speaker_names = [s.name for s in speakers]

        print(f'   [{idx+1}/{len(sections)}] {section["title"][:50]}...')
        print(f'      Speakers: {", ".join(speaker_names[:3])}{"..." if len(speaker_names) > 3 else ""}')
        
        ministry_acronym = detect_ministry(section)
        if ministry_acronym:
            print(f'      Ministry: {ministry_acronym}')
        
        ministry_id = find_ministry_by_acronym(ministry_acronym) if ministry_acronym else None
        
        # Handle bill sections - create/find parent bill entity
        bill_id = None
        section_type = section['section_type']
        if section_type in ('BI', 'BP'):
            # For first reading (BI), set the first reading date
            first_reading_date = metadata.get('date') if section_type == 'BI' else None
            first_reading_session_id = session_id if section_type == 'BI' else None
            
            bill_id = find_or_create_bill(
                title=section['title'],
                ministry_id=ministry_id,
                first_reading_date=first_reading_date,
                first_reading_session_id=first_reading_session_id
            )
            print(f'      Bill ID: {bill_id}')
        
        section_result = execute_query(
            '''INSERT INTO sections 
               (session_id, ministry_id, bill_id, category, section_type, section_title, 
                content_html, content_plain, section_order, source_url)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id''',
            (
                session_id,
                ministry_id,
                bill_id,
                section.get('category', 'question'),
                section['section_type'],
                section['title'],
                section['content_html'],
                section['content_plain'],
                section['order'],
                section.get('source_url')
            ),
            fetch=True
        )
        
        section_id = section_result[0]['id']
        
        for speaker in speakers:
            member_id = find_or_create_member(speaker.name)
            add_section_speaker(
                section_id=section_id,
                member_id=member_id,
                constituency=getattr(speaker, 'constituency', None),
                designation=getattr(speaker, 'appointment', None)
            )
        
        processed += 1
    
    print(f'Complete! Processed {processed} sections')
    
    # Refresh materialized view for fast member list queries
    refresh_member_list_view()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python process_hansard.py DD-MM-YYYY')
        print('Example: python process_hansard.py 14-01-2026')
        sys.exit(1)
    
    process_hansard_by_date(sys.argv[1])