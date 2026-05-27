"""
ZeroTrace Task Executor
Routes user commands to the appropriate automation module.
Includes: Email, PDF, Browser, Research, Google, File Management, Web Automation, WhatsApp
"""

import re
from .email_sender import send_email, parse_email_command
from .pdf_generator import generate_pdf, parse_pdf_command
from .browser_automation import execute_browser_command
from .research_engine import run_research, parse_research_command
from .feedback_engine import record_outcome


def detect_and_execute(user_message: str, ai_response: str = '') -> dict:
    message_lower = user_message.lower().strip()

    # ── Google automations ─────────────────────────────
    google_keywords = [
        'google calendar', 'create event', 'schedule meeting', 'add to calendar',
        'google sheet', 'create spreadsheet', 'google doc', 'create document',
        'upcoming events', 'my schedule',
    ]
    if any(kw in message_lower for kw in google_keywords):
        return _execute_google(user_message, ai_response)

    # ── WhatsApp ───────────────────────────────────────
    if any(w in message_lower for w in ['whatsapp', 'whats app', 'send whatsapp']):
        return _execute_whatsapp(user_message)

    # ── File management ────────────────────────────────
    file_keywords = [
        'organize', 'sort files', 'clean up folder', 'find duplicates',
        'compress folder', 'zip folder', 'rename files', 'move files',
        'organize downloads', 'organize desktop',
    ]
    if any(kw in message_lower for kw in file_keywords):
        return _execute_file_management(user_message)

    # ── Web scraping / monitoring ──────────────────────
    web_keywords = [
        'scrape website', 'extract data from', 'monitor website',
        'check website', 'download file from', 'watch website',
    ]
    if any(kw in message_lower for kw in web_keywords):
        return _execute_web_automation(user_message)

    # ── Research mode ──────────────────────────────────
    research_keywords = [
        'research', 'find information about', 'gather information',
        'write a report on', 'make a report about', 'investigate',
        'give me a report on', 'create a report about',
    ]
    if any(kw in message_lower for kw in research_keywords):
        return _execute_research(user_message)

    # ── Browser automation ─────────────────────────────
    browser_triggers = [
        'search google', 'google search', 'search for', 'google for',
        'open chrome', 'open browser', 'open youtube', 'youtube search',
        'search youtube', 'navigate to', 'go to http', 'visit website',
        'look up', 'find on google', 'browse to', 'search on google',
        'open website', 'go to website',
    ]
    starts_with_browser = any(message_lower.startswith(w) for w in [
        'search ', 'find ', 'google ', 'open ', 'go to ', 'visit ', 'browse '
    ])
    is_browser = any(t in message_lower for t in browser_triggers) or starts_with_browser

    if is_browser:
        has_email = bool(re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', user_message))
        email_keywords = ['send email', 'send this to', 'email to', 'send to', 'mail to']
        is_email = has_email and any(kw in message_lower for kw in email_keywords)
        if not is_email:
            return _execute_browser(user_message)

    # ── Email ──────────────────────────────────────────
    email_keywords = ['send email', 'send this to', 'email to', 'send to', 'mail to', 'send it to']
    has_email_keyword = any(kw in message_lower for kw in email_keywords)
    has_email_address = bool(re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', user_message))

    if has_email_keyword and has_email_address:
        return _execute_email(user_message, ai_response)

    # ── PDF ────────────────────────────────────────────
    pdf_keywords = ['create pdf', 'make pdf', 'generate pdf', 'write pdf',
                    'create a pdf', 'make a pdf', 'generate a pdf', 'write a pdf']
    if any(kw in message_lower for kw in pdf_keywords):
        if has_email_address:
            return _execute_pdf_and_email(user_message, ai_response)
        return _execute_pdf(user_message, ai_response)

    return {'executed': False, 'task_type': 'chat', 'result': '', 'steps': []}


# ─── Executors ────────────────────────────────────────────────────────────────

def _execute_google(user_message: str, ai_response: str) -> dict:
    steps = [{'label': 'Connecting to Google API', 'status': 'running'}]
    try:
        from .google_automation import execute_google_command
        result = execute_google_command(user_message, ai_response)
        steps[-1]['status'] = 'done' if result.get('success') else 'failed'
        return {
            'executed': True,
            'task_type': 'google',
            'result': f"✅ {result.get('summary', result.get('message', ''))}" if result.get('success') else f"❌ {result.get('error')}",
            'steps': steps,
        }
    except Exception as e:
        steps[-1]['status'] = 'failed'
        return {'executed': True, 'task_type': 'google', 'result': f'❌ Google error: {str(e)}\n\nMake sure `google_credentials.json` is in the backend folder.', 'steps': steps}


def _execute_whatsapp(user_message: str) -> dict:
    steps = [{'label': 'Opening WhatsApp Web', 'status': 'running'}]
    try:
        from .web_automation import execute_web_command
        result = execute_web_command(user_message)
        steps.extend(result.get('steps', []))
        return {
            'executed': True,
            'task_type': 'whatsapp',
            'result': result.get('summary', '❌ WhatsApp failed'),
            'steps': steps,
        }
    except Exception as e:
        return {'executed': True, 'task_type': 'whatsapp', 'result': f'❌ WhatsApp error: {str(e)}', 'steps': steps}


def _execute_file_management(user_message: str) -> dict:
    steps = [{'label': 'Analyzing file management command', 'status': 'done'}]
    try:
        from .file_manager import execute_file_command
        result = execute_file_command(user_message)
        steps.append({'label': result.get('summary', 'Done')[:50], 'status': 'done' if result.get('success') else 'failed'})
        return {
            'executed': True,
            'task_type': 'file',
            'result': result.get('summary', '❌ File operation failed'),
            'steps': steps,
        }
    except Exception as e:
        return {'executed': True, 'task_type': 'file', 'result': f'❌ File error: {str(e)}', 'steps': steps}


def _execute_web_automation(user_message: str) -> dict:
    steps = [{'label': 'Parsing web automation command', 'status': 'done'}]
    try:
        from .web_automation import execute_web_command
        result = execute_web_command(user_message)
        steps.append({'label': 'Web task completed', 'status': 'done' if result.get('success') else 'failed'})
        return {
            'executed': True,
            'task_type': 'web',
            'result': result.get('summary', '❌ Web automation failed'),
            'steps': steps,
        }
    except Exception as e:
        return {'executed': True, 'task_type': 'web', 'result': f'❌ Web error: {str(e)}', 'steps': steps}


def _execute_research(user_message: str) -> dict:
    steps = [{'label': 'Starting research pipeline', 'status': 'done'}]
    try:
        parsed = parse_research_command(user_message)
        result = run_research(topic=parsed['topic'], to_email=parsed['to_email'])
        steps = result.get('steps', steps)
        lines = [f"✅ **Research Complete: {parsed['topic']}**\n"]
        lines.append(f"📖 **Sources scraped:** {result['sources_count']}")
        if result.get('pdf_path'):
            lines.append(f"📄 **PDF saved:** `{result['pdf_path']}`")
        if result.get('email_sent'):
            lines.append(f"📧 **Report emailed to:** {parsed['to_email']}")
        lines.append(f"\n---\n\n{result['summary'][:1500]}...")
        return {'executed': True, 'task_type': 'research', 'result': '\n'.join(lines), 'steps': steps}
    except Exception as e:
        return {'executed': True, 'task_type': 'research', 'result': f'❌ Research failed: {str(e)}', 'steps': steps}


def _execute_browser(user_message: str) -> dict:
    steps = [{'label': 'Detecting browser command', 'status': 'done'}]
    try:
        result = execute_browser_command(user_message)
        steps.extend(result.get('steps', []))
        final = f"✅ **Browser automation completed!**\n\n{result.get('summary', '')}" if result['success'] else f"❌ {result.get('error')}"
        return {'executed': True, 'task_type': 'browser', 'result': final, 'steps': steps}
    except Exception as e:
        return {'executed': True, 'task_type': 'browser', 'result': f'❌ Browser error: {str(e)}', 'steps': steps}


def _execute_email(user_message: str, ai_response: str) -> dict:
    steps = [{'label': 'Parsing email details', 'status': 'done'}]
    details = parse_email_command(user_message, ai_response)
    if not details['to']:
        return {'executed': True, 'task_type': 'email', 'result': '❌ No email address found.', 'steps': steps}
    steps.append({'label': f'Sending to {details["to"]}', 'status': 'running'})
    success, message = send_email(to_email=details['to'], subject=details['subject'], body=details['body'])
    steps[-1]['status'] = 'done' if success else 'failed'
    result = f"✅ **Email sent!**\n\n**To:** {details['to']}\n**Subject:** {details['subject']}\n\n{message}" if success else f"❌ **Email failed:** {message}"
    return {'executed': True, 'task_type': 'email', 'result': result, 'steps': steps}


def _execute_pdf(user_message: str, ai_response: str) -> dict:
    steps = [{'label': 'Generating PDF', 'status': 'running'}]
    details = parse_pdf_command(user_message)
    content = ai_response if ai_response else details['content']
    success, filepath, message = generate_pdf(details['title'], content)
    steps[-1]['status'] = 'done' if success else 'failed'
    result = f"✅ **PDF Created!**\n\n**Title:** {details['title']}\n**Location:** `{filepath}`" if success else f"❌ {message}"
    return {'executed': True, 'task_type': 'pdf', 'result': result, 'steps': steps}


def _execute_pdf_and_email(user_message: str, ai_response: str) -> dict:
    steps = [{'label': 'Generating PDF', 'status': 'running'}]
    details = parse_pdf_command(user_message)
    content = ai_response if ai_response else details['content']
    pdf_success, filepath, pdf_message = generate_pdf(details['title'], content)
    steps[-1]['status'] = 'done' if pdf_success else 'failed'
    if not pdf_success:
        return {'executed': True, 'task_type': 'pdf+email', 'result': f'❌ PDF failed: {pdf_message}', 'steps': steps}
    email_details = parse_email_command(user_message, ai_response)
    steps.append({'label': f'Sending to {email_details["to"]}', 'status': 'running'})
    email_success, email_message = send_email(
        to_email=email_details['to'],
        subject=email_details['subject'] or details['title'],
        body=f'<p>PDF attached: <b>{details["title"]}</b></p>',
        attachment_path=filepath,
    )
    steps[-1]['status'] = 'done' if email_success else 'failed'
    result = f"✅ **PDF created and emailed!**\n\n**PDF:** {details['title']}\n**Sent to:** {email_details['to']}" if email_success else f"✅ PDF created but email failed: {email_message}"
    return {'executed': True, 'task_type': 'pdf+email', 'result': result, 'steps': steps}