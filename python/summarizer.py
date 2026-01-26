import os
import json
import sys
from google import genai
from dotenv import load_dotenv
from db import execute_query

load_dotenv()

def get_gemini_client():
    return genai.Client(api_key=os.getenv('GEMINI_API_KEY'))

def generate_session_summary(session_id):
    sections = execute_query(
        '''SELECT s.section_type, s.section_title, m.acronym as ministry
           FROM sections s
           LEFT JOIN ministries m ON s.ministry_id = m.id
           WHERE s.session_id = %s
           ORDER BY s.section_order''',
        (session_id,),
        fetch=True
    )
    
    if not sections:
        print(f"No sections found for session {session_id}")
        return None
    
    section_summaries = []
    for s in sections:
        ministry_tag = f"[{s['ministry']}] " if s['ministry'] else ""
        section_summaries.append(f"- {ministry_tag}{s['section_title']}")
    
    context = "\n".join(section_summaries)
    
    prompt = f"""You are reporting writing a summary of the Singapore Parliament session. Based on the sections, 
                write a page-long executive briefing of the key topics discussed and decisions made.

                Sections:
                {context}

                Write a concise, informative summary suitable for someone who wants to quickly understand 
                what happened in this session. Focus on the most significant topics and any notable outcomes."""

    client = get_gemini_client()
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[{'parts': [{'text': prompt}]}]
        )
        summary = response.text.strip()
        
        execute_query(
            'UPDATE sessions SET summary = %s WHERE id = %s',
            (summary, session_id)
        )
        
        print(f"Session summary generated and saved.")
        return summary
    except Exception as e:
        print(f"Error generating session summary: {e}")
        return None

def generate_member_summary(member_id):
    member = execute_query(
        'SELECT name FROM members WHERE id = %s',
        (member_id,),
        fetch=True
    )
    if not member:
        print(f"Member {member_id} not found")
        return None
    
    member_name = member[0]['name']
    
    activity = execute_query(
        '''SELECT s.section_title, s.section_type, m.acronym as ministry,
                  ss.designation, sess.date
           FROM section_speakers ss
           JOIN sections s ON ss.section_id = s.id
           JOIN sessions sess ON s.session_id = sess.id
           LEFT JOIN ministries m ON s.ministry_id = m.id
           WHERE ss.member_id = %s
           ORDER BY sess.date DESC''',
        (member_id,),
        fetch=True
    )
    
    if not activity:
        print(f"No activity found for member {member_name}")
        return None
    
    recent_designation = activity[0]['designation'] or "MP"
    
    activity_lines = []
    for a in activity:
        ministry_tag = f"[{a['ministry']}] " if a['ministry'] else ""
        activity_lines.append(f"- {a['date']}: {ministry_tag}{a['section_title'][:80]}")
    
    context = "\n".join(activity_lines)
    
    prompt = f"""Based on this parliamentary activity for {member_name} ({recent_designation}), write a brief 2-paragraph profile summarizing:
                1. Their role and focus areas
                2. Key topics they have addressed recently

                Recent Activity:
                {context}

                Write in third person, suitable for a public profile page."""

    client = get_gemini_client()
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=[{'parts': [{'text': prompt}]}]
        )
        summary = response.text.strip()
        
        # Upsert member summary
        execute_query(
            '''INSERT INTO member_summaries (member_id, summary, last_updated)
               VALUES (%s, %s, NOW())
               ON CONFLICT (member_id) DO UPDATE SET summary = EXCLUDED.summary, last_updated = NOW()''',
            (member_id, summary)
        )
        
        print(f"Member summary for {member_name} generated and saved.")
        return summary
    except Exception as e:
        print(f"Error generating member summary: {e}")
        return None

def summarize_all_sessions():
    """Generate summaries for all sessions that don't have one yet."""
    sessions = execute_query(
        'SELECT id FROM sessions WHERE summary IS NULL ORDER BY date DESC',
        fetch=True
    )
    for session in sessions:
        generate_session_summary(session['id'])

def summarize_all_members():
    """Generate summaries for all members."""
    members = execute_query('SELECT id FROM members', fetch=True)
    for member in members:
        generate_member_summary(member['id'])

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python summarizer.py sessions     - Generate all session summaries")
        print("  python summarizer.py members      - Generate all member summaries")
        print("  python summarizer.py all          - Generate both")
        sys.exit(1)
    
    cmd = sys.argv[1]
    if cmd == 'sessions':
        summarize_all_sessions()
    elif cmd == 'members':
        summarize_all_members()
    elif cmd == 'all':
        summarize_all_sessions()
        summarize_all_members()
    else:
        print(f"Unknown command: {cmd}")
