"""
ZeroTrace Google Automation
Handles Google Calendar, Sheets, and Docs via Google API.
"""

import os
import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import re

# Scopes needed
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
]

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CREDENTIALS_FILE = BASE_DIR / 'google_credentials.json'
TOKEN_FILE = BASE_DIR / 'generated_files' / 'google_token.json'


def get_google_service(service_name: str, version: str):
    """Authenticate and return a Google API service."""
    creds = None

    # Load existing token
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)

    # If no valid credentials, authenticate
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_FILE.exists():
                raise FileNotFoundError(
                    f'google_credentials.json not found at {CREDENTIALS_FILE}. '
                    'Please download it from Google Cloud Console.'
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(CREDENTIALS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)

        # Save token
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_FILE, 'w') as f:
            f.write(creds.to_json())

    return build(service_name, version, credentials=creds)


# ─── GOOGLE CALENDAR ──────────────────────────────────────────────────────────

def create_calendar_event(title: str, date_str: str, time_str: str = '10:00',
                           duration_hours: int = 1, description: str = '',
                           attendees: list = None) -> dict:
    """Create a Google Calendar event."""
    try:
        service = get_google_service('calendar', 'v3')

        # Parse date and time
        try:
            if 'tomorrow' in date_str.lower():
                event_date = datetime.now() + timedelta(days=1)
            elif 'today' in date_str.lower():
                event_date = datetime.now()
            else:
                event_date = datetime.strptime(date_str, '%Y-%m-%d')
        except Exception:
            event_date = datetime.now() + timedelta(days=1)

        # Parse time
        try:
            hour, minute = map(int, time_str.replace('am', '').replace('pm', '').split(':'))
            if 'pm' in time_str.lower() and hour != 12:
                hour += 12
        except Exception:
            hour, minute = 10, 0

        start_dt = event_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
        end_dt = start_dt + timedelta(hours=duration_hours)

        event = {
            'summary': title,
            'description': description,
            'start': {
                'dateTime': start_dt.isoformat(),
                'timeZone': 'Asia/Kolkata',
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': 'Asia/Kolkata',
            },
        }

        if attendees:
            event['attendees'] = [{'email': email} for email in attendees]

        result = service.events().insert(calendarId='primary', body=event).execute()

        return {
            'success': True,
            'event_id': result.get('id'),
            'title': title,
            'start': start_dt.strftime('%B %d, %Y at %I:%M %p'),
            'link': result.get('htmlLink'),
            'message': f'Event "{title}" created on {start_dt.strftime("%B %d, %Y at %I:%M %p")}',
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def get_upcoming_events(days: int = 7) -> dict:
    """Get upcoming calendar events."""
    try:
        service = get_google_service('calendar', 'v3')

        now = datetime.utcnow().isoformat() + 'Z'
        end = (datetime.utcnow() + timedelta(days=days)).isoformat() + 'Z'

        events_result = service.events().list(
            calendarId='primary',
            timeMin=now,
            timeMax=end,
            maxResults=10,
            singleEvents=True,
            orderBy='startTime'
        ).execute()

        events = events_result.get('items', [])

        event_list = []
        for event in events:
            start = event['start'].get('dateTime', event['start'].get('date'))
            event_list.append({
                'title': event.get('summary', 'No title'),
                'start': start,
                'description': event.get('description', ''),
            })

        return {
            'success': True,
            'events': event_list,
            'count': len(event_list),
            'message': f'Found {len(event_list)} upcoming events in next {days} days',
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── GOOGLE SHEETS ────────────────────────────────────────────────────────────

def create_sheet(title: str, data: list = None) -> dict:
    """Create a new Google Sheet with optional data."""
    try:
        service = get_google_service('sheets', 'v4')

        spreadsheet = {
            'properties': {'title': title},
        }

        result = service.spreadsheets().create(body=spreadsheet).execute()
        spreadsheet_id = result['spreadsheetId']

        # Add data if provided
        if data:
            body = {'values': data}
            service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range='Sheet1!A1',
                valueInputOption='RAW',
                body=body
            ).execute()

        return {
            'success': True,
            'spreadsheet_id': spreadsheet_id,
            'title': title,
            'url': f'https://docs.google.com/spreadsheets/d/{spreadsheet_id}',
            'message': f'Spreadsheet "{title}" created successfully',
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def read_sheet(spreadsheet_id: str, range_name: str = 'Sheet1!A1:Z100') -> dict:
    """Read data from a Google Sheet."""
    try:
        service = get_google_service('sheets', 'v4')

        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()

        values = result.get('values', [])

        return {
            'success': True,
            'data': values,
            'rows': len(values),
            'message': f'Read {len(values)} rows from sheet',
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


def append_to_sheet(spreadsheet_id: str, data: list) -> dict:
    """Append rows to a Google Sheet."""
    try:
        service = get_google_service('sheets', 'v4')

        body = {'values': data}
        result = service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range='Sheet1!A1',
            valueInputOption='RAW',
            body=body
        ).execute()

        return {
            'success': True,
            'updated_rows': result.get('updates', {}).get('updatedRows', 0),
            'message': f'Added {len(data)} rows to sheet',
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── GOOGLE DOCS ──────────────────────────────────────────────────────────────

def create_doc(title: str, content: str = '') -> dict:
    """Create a new Google Doc."""
    try:
        service = get_google_service('docs', 'v1')

        doc = service.documents().create(body={'title': title}).execute()
        doc_id = doc['documentId']

        # Add content if provided
        if content:
            requests = [{
                'insertText': {
                    'location': {'index': 1},
                    'text': content
                }
            }]
            service.documents().batchUpdate(
                documentId=doc_id,
                body={'requests': requests}
            ).execute()

        return {
            'success': True,
            'doc_id': doc_id,
            'title': title,
            'url': f'https://docs.google.com/document/d/{doc_id}',
            'message': f'Document "{title}" created successfully',
        }

    except Exception as e:
        return {'success': False, 'error': str(e)}


# ─── COMMAND PARSER ───────────────────────────────────────────────────────────

def parse_google_command(user_message: str) -> dict:
    """Parse user message to determine Google action."""
    msg = user_message.lower()

    # Calendar
    if any(w in msg for w in ['calendar', 'event', 'meeting', 'schedule', 'remind']):
        # Extract title
        title_match = re.search(r'(?:create|add|schedule|set up)\s+(?:a\s+)?(?:meeting|event|reminder)?\s*(?:called|named|titled|:)?\s*["\']?(.+?)["\']?(?:\s+on|\s+for|\s+at|$)', msg, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else 'Meeting'

        # Extract date
        date_match = re.search(r'(tomorrow|today|\d{4}-\d{2}-\d{2})', msg, re.IGNORECASE)
        date = date_match.group(1) if date_match else 'tomorrow'

        # Extract time
        time_match = re.search(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm))', msg, re.IGNORECASE)
        time = time_match.group(1) if time_match else '10:00am'

        return {'action': 'calendar_create', 'title': title, 'date': date, 'time': time}

    if any(w in msg for w in ['upcoming events', 'my schedule', 'what\'s on', 'calendar today']):
        return {'action': 'calendar_read'}

    # Sheets
    if any(w in msg for w in ['spreadsheet', 'sheet', 'excel', 'google sheet']):
        title_match = re.search(r'(?:create|make|new)\s+(?:a\s+)?(?:spreadsheet|sheet)\s+(?:called|named)?\s*["\']?(.+?)["\']?$', msg, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else 'New Spreadsheet'
        return {'action': 'sheet_create', 'title': title}

    # Docs
    if any(w in msg for w in ['google doc', 'document', 'create doc', 'write doc']):
        title_match = re.search(r'(?:create|make|write)\s+(?:a\s+)?(?:google\s+)?doc(?:ument)?\s+(?:called|named|about)?\s*["\']?(.+?)["\']?$', msg, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else 'New Document'
        return {'action': 'doc_create', 'title': title}

    return {'action': 'unknown'}


def execute_google_command(user_message: str, content: str = '') -> dict:
    """Execute a Google API command based on user message."""
    command = parse_google_command(user_message)
    action = command.get('action')

    if action == 'calendar_create':
        result = create_calendar_event(
            title=command.get('title', 'Meeting'),
            date_str=command.get('date', 'tomorrow'),
            time_str=command.get('time', '10:00am'),
        )
        if result['success']:
            result['summary'] = f"📅 **Calendar event created!**\n\n**Title:** {result['title']}\n**When:** {result['start']}\n**Link:** {result['link']}"
        return result

    elif action == 'calendar_read':
        result = get_upcoming_events()
        if result['success']:
            events_text = '\n'.join([f"• {e['title']} — {e['start']}" for e in result['events']])
            result['summary'] = f"📅 **Upcoming Events:**\n\n{events_text or 'No upcoming events'}"
        return result

    elif action == 'sheet_create':
        result = create_sheet(title=command.get('title', 'New Sheet'))
        if result['success']:
            result['summary'] = f"📊 **Google Sheet created!**\n\n**Title:** {result['title']}\n**URL:** {result['url']}"
        return result

    elif action == 'doc_create':
        result = create_doc(title=command.get('title', 'New Doc'), content=content)
        if result['success']:
            result['summary'] = f"📝 **Google Doc created!**\n\n**Title:** {result['title']}\n**URL:** {result['url']}"
        return result

    return {'success': False, 'error': 'Could not determine Google action', 'summary': ''}
