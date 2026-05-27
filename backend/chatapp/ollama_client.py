"""
ZeroTrace Ollama Client
Connects to local Ollama LLM with intelligent model routing.
"""

import requests
import json
from django.conf import settings

OLLAMA_URL = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:latest')

SYSTEM_PROMPT = (
    "You are ZeroTrace AI, a privacy-first local AI assistant.\n\n"
    "IMPORTANT RULES:\n"
    "- When automation tasks are executed (email, browser, files, research, calendar), "
    "DO NOT explain how to do it with code examples\n"
    "- DO NOT show Python code unless the user specifically asks for code\n"
    "- Just acknowledge what the user wants in 1-2 sentences, then let the automation engine handle it\n"
    "- Be concise — maximum 3-4 sentences for non-code responses\n"
    "- Never say 'here is how you can do it' — just confirm the action briefly\n"
    "- For automation requests like organize files, send email, search web: "
    "just say 'On it!' or 'Executing now...' in one sentence\n"
    "- For questions, answer directly and concisely\n\n"
    "Examples:\n"
    "- User: 'organize my downloads' -> Say: 'Organizing your Downloads folder now...'\n"
    "- User: 'send email to x@gmail.com' -> Say: 'Sending email to x@gmail.com now...'\n"
    "- User: 'what is AI?' -> Give a clear 2-3 sentence answer\n"
    "- User: 'write python code to sort a list' -> Give the code\n\n"
    "You run 100% locally on the user machine. No data is sent to any cloud server."
)


def chat_with_ollama(messages: list, stream: bool = False):
    """
    Send messages to Ollama and get response.
    Returns: (response_text, tokens_used)
    """
    payload = {
        'model': OLLAMA_MODEL,
        'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}] + messages,
        'stream': stream,
        'options': {
            'temperature': 0.4,
            'top_p': 0.9,
            'num_predict': 512,
        }
    }

    try:
        if stream:
            return _stream_response(payload)
        else:
            return _single_response(payload)
    except requests.exceptions.ConnectionError:
        return "Ollama is not running. Please start it with: ollama serve", 0
    except Exception as e:
        return f"Error: {str(e)}", 0


def _single_response(payload):
    response = requests.post(
        f'{OLLAMA_URL}/api/chat',
        json=payload,
        timeout=120
    )
    response.raise_for_status()
    data = response.json()
    content = data.get('message', {}).get('content', '')
    tokens = data.get('eval_count', 0) + data.get('prompt_eval_count', 0)
    return content, tokens


def _stream_response(payload):
    with requests.post(
        f'{OLLAMA_URL}/api/chat',
        json=payload,
        stream=True,
        timeout=120
    ) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    chunk = data.get('message', {}).get('content', '')
                    if chunk:
                        yield chunk
                except json.JSONDecodeError:
                    continue


def check_ollama_status():
    """Check if Ollama is running and return available models."""
    try:
        response = requests.get(f'{OLLAMA_URL}/api/tags', timeout=5)
        response.raise_for_status()
        models = [m['name'] for m in response.json().get('models', [])]
        return {'status': 'online', 'models': models}
    except Exception:
        return {'status': 'offline', 'models': []}


def detect_task_type(message: str) -> str:
    """Use spaCy NLP parser to detect task type."""
    try:
        from .nlp_parser import parse_intent
        parsed = parse_intent(message)
        return parsed.intent
    except Exception:
        msg = message.lower()
        if any(w in msg for w in ['email', 'send to', 'gmail', 'mail to']):
            return 'email'
        if any(w in msg for w in ['pdf', 'document', 'report']):
            return 'pdf'
        if any(w in msg for w in ['browser', 'search', 'google', 'chrome']):
            return 'browser'
        if any(w in msg for w in ['research', 'investigate', 'analyze']):
            return 'research'
        return 'chat'