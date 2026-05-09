import requests
import json
from django.conf import settings


OLLAMA_URL = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:latest')

SYSTEM_PROMPT = """You are ZeroTrace AI, a powerful local AI assistant that runs 100% on the user's machine.
You can help with:
- Research and summarization
- Writing and editing
- Task automation planning (browser, email, file tasks)
- Code generation and debugging
- PDF creation and document generation
- General questions and analysis

When the user asks you to perform automation tasks (open browser, send email, fill forms, etc.),
describe what you would do step by step, then confirm you are executing each step.

Always be helpful, concise, and remind the user that their data stays local and private.
"""


def chat_with_ollama(messages: list, stream: bool = False):
    """
    Send messages to Ollama and get a response.
    messages: list of {role: 'user'|'assistant', content: str}
    Returns: (response_text, tokens_used)
    """
    payload = {
        'model': OLLAMA_MODEL,
        'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}] + messages,
        'stream': stream,
        'options': {
            'temperature': 0.7,
            'top_p': 0.9,
        }
    }

    try:
        if stream:
            return _stream_response(payload)
        else:
            return _single_response(payload)
    except requests.exceptions.ConnectionError:
        return "❌ Ollama is not running. Please start it with: `ollama serve`", 0
    except Exception as e:
        return f"❌ Error communicating with Ollama: {str(e)}", 0


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
    """Generator that yields text chunks as they arrive from Ollama."""
    with requests.post(
        f'{OLLAMA_URL}/api/chat',
        json=payload,
        stream=True,
        timeout=120
    ) as response:
        response.raise_for_status()
        total_tokens = 0
        for line in response.iter_lines():
            if line:
                try:
                    data = json.loads(line)
                    chunk = data.get('message', {}).get('content', '')
                    if chunk:
                        yield chunk
                    if data.get('done'):
                        total_tokens = data.get('eval_count', 0) + data.get('prompt_eval_count', 0)
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
    """Detect what kind of task the user is requesting."""
    message_lower = message.lower()
    if any(w in message_lower for w in ['email', 'gmail', 'send mail', 'inbox', 'reply']):
        return 'email'
    if any(w in message_lower for w in ['pdf', 'document', 'report', 'convert']):
        return 'pdf'
    if any(w in message_lower for w in ['browser', 'chrome', 'website', 'form', 'search', 'scrape', 'navigate']):
        return 'browser'
    if any(w in message_lower for w in ['research', 'find information', 'summarize', 'analyze']):
        return 'research'
    return 'chat'
