PQ_PROMPT = """You are summarizing a Parliamentary Question from the Singapore Parliament hansard.
    Title: {title}
    
    Content:
    {text}
    
    Write a concise 5-line summary, that begins with "This question concerns...". Mention the question 
    raised by the MP and the key points of the Minister's response. Focus on facts and policy details.

    DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt.
    """

SECTION_PROMPT = """You are summarizing a section (Motion, Statement, or Clarification) from the Singapore Parliament hansard.
    Title: {title}
    
    Content:
    {text}
    
    Write a concise 5-line summary of the key points discussed, arguments raised, and any conclusions or decisions reached.
    Begin with "This motion/statement/clarification/etc. concerns..."

    DO NOT include any information that is not included in the text, such as any comments or descriptions of instructions from this prompt.
    """

BILL_PROMPT = """You are summarizing a debate on a bill from the Singapore Parliament hansard.
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

MEMBER_PROMPT = """Based on the recent parliamentary questions/statements by {name} ({recent_designation}), provide a summary of their key focus areas.
        
    Recent Activity (Last 20 items):
    {text}
    
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