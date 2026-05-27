"""
ZeroTrace Multi-Model LLM Router
Automatically selects the best local Ollama model based on prompt analysis.
Uses spaCy NLP + rule-based routing for intelligent model selection.
"""

import requests
import re
from django.conf import settings

OLLAMA_URL = getattr(settings, 'OLLAMA_BASE_URL', 'http://localhost:11434')

# ─── Model definitions ────────────────────────────────────────────────────────

AVAILABLE_MODELS = {
    'llama3.2:latest': {
        'display_name': 'Llama 3.2',
        'strengths': ['general', 'reasoning', 'research', 'analysis', 'chat'],
        'speed': 'medium',
        'quality': 'high',
        'description': 'Best for general reasoning and research tasks',
        'icon': '🦙',
    },
    'mistral:latest': {
        'display_name': 'Mistral 7B',
        'strengths': ['creative', 'writing', 'summarization', 'email', 'pdf'],
        'speed': 'fast',
        'quality': 'high',
        'description': 'Best for creative writing, emails and document generation',
        'icon': '🌪️',
    },
    'codellama:latest': {
        'display_name': 'Code Llama',
        'strengths': ['code', 'programming', 'debugging', 'technical', 'script'],
        'speed': 'medium',
        'quality': 'excellent',
        'description': 'Best for code generation and technical tasks',
        'icon': '💻',
    },
}

# Fallback model if routing fails
DEFAULT_MODEL = 'llama3.2:latest'


# ─── Routing rules ────────────────────────────────────────────────────────────

ROUTING_RULES = {
    'codellama:latest': {
        'keywords': [
            'code', 'program', 'function', 'debug', 'error', 'bug', 'script',
            'python', 'javascript', 'java', 'html', 'css', 'react', 'django',
            'algorithm', 'class', 'method', 'api', 'database', 'sql', 'syntax',
            'compile', 'runtime', 'library', 'framework', 'git', 'terminal',
            'write a function', 'write code', 'fix this code', 'explain this code',
        ],
        'patterns': [
            r'def\s+\w+', r'class\s+\w+', r'import\s+\w+',
            r'```', r'<\w+>', r'\w+\(\)',
        ],
        'weight': 3.0,
    },
    'mistral:latest': {
        'keywords': [
            'write', 'draft', 'compose', 'email', 'letter', 'essay', 'story',
            'creative', 'poem', 'blog', 'article', 'summarize', 'summary',
            'pdf', 'document', 'report', 'describe', 'explain simply',
            'rewrite', 'paraphrase', 'translate', 'grammar',
        ],
        'patterns': [
            r'write (a|an|the)', r'draft (a|an)', r'compose (a|an)',
            r'create (a|an) (email|letter|essay|story|poem)',
        ],
        'weight': 2.5,
    },
    'llama3.2:latest': {
        'keywords': [
            'research', 'analyze', 'compare', 'explain', 'what is', 'how does',
            'why', 'difference between', 'pros and cons', 'recommend',
            'search', 'find', 'information', 'facts', 'history', 'science',
            'mathematics', 'calculate', 'logic', 'reasoning', 'philosophy',
        ],
        'patterns': [
            r'what (is|are|was|were)', r'how (do|does|did|can)',
            r'why (is|are|did|does)', r'explain (the|how|why)',
        ],
        'weight': 2.0,
    },
}


# ─── Router functions ─────────────────────────────────────────────────────────

def get_available_models() -> list:
    """Get list of models actually installed in Ollama."""
    try:
        response = requests.get(f'{OLLAMA_URL}/api/tags', timeout=5)
        response.raise_for_status()
        installed = [m['name'] for m in response.json().get('models', [])]
        return installed
    except Exception:
        return [DEFAULT_MODEL]


def route_to_model(prompt: str) -> dict:
    """
    Analyze prompt and select the best model.
    Returns dict with model name and routing explanation.
    """
    prompt_lower = prompt.lower()
    installed_models = get_available_models()

    scores = {}
    reasons = {}

    for model, rules in ROUTING_RULES.items():
        # Skip if model not installed
        if not any(model.split(':')[0] in m for m in installed_models):
            continue

        score = 0.0
        matched_reasons = []

        # Check keywords
        for kw in rules['keywords']:
            if kw in prompt_lower:
                score += rules['weight']
                matched_reasons.append(f'keyword: "{kw}"')

        # Check regex patterns
        for pattern in rules['patterns']:
            if re.search(pattern, prompt, re.IGNORECASE):
                score += rules['weight'] * 1.5
                matched_reasons.append(f'pattern match')

        if score > 0:
            scores[model] = score
            reasons[model] = matched_reasons[:3]  # top 3 reasons

    # Pick winner
    if scores:
        best_model = max(scores, key=scores.get)
        best_score = scores[best_model]
        model_info = AVAILABLE_MODELS.get(best_model, {})

        return {
            'model': best_model,
            'display_name': model_info.get('display_name', best_model),
            'icon': model_info.get('icon', '🤖'),
            'description': model_info.get('description', ''),
            'score': best_score,
            'reasons': reasons.get(best_model, []),
            'confidence': 'high' if best_score > 5 else 'medium' if best_score > 2 else 'low',
            'all_scores': {m: round(s, 2) for m, s in scores.items()},
            'routing_method': 'keyword + pattern matching',
        }

    # Default fallback
    available = [m for m in installed_models if 'llama3' in m]
    fallback = available[0] if available else DEFAULT_MODEL
    model_info = AVAILABLE_MODELS.get(fallback, {})

    return {
        'model': fallback,
        'display_name': model_info.get('display_name', fallback),
        'icon': model_info.get('icon', '🤖'),
        'description': 'Default model selected',
        'score': 0,
        'reasons': ['No specific routing rules matched — using default model'],
        'confidence': 'low',
        'all_scores': {},
        'routing_method': 'default fallback',
    }


def chat_with_routed_model(messages: list, prompt: str = '') -> tuple:
    """
    Route to best model and get response.
    Returns: (response_text, tokens_used, routing_info)
    """
    routing = route_to_model(prompt or (messages[-1]['content'] if messages else ''))
    model = routing['model']

    system_prompt = (
    "You are ZeroTrace AI, a privacy-first local AI assistant running on " + routing['display_name'] + ".\n"
    "RULES:\n"
    "- For automation tasks (organize files, send email, create calendar, search web): "
    "just say 'On it!' or confirm in ONE sentence. Never show code examples.\n"
    "- For code questions: provide working code.\n"
    "- For general questions: answer concisely in 2-3 sentences.\n"
    "- NEVER explain how to do automation tasks manually — the system does it automatically.\n"
    "You run 100% locally. No data sent to cloud."
)

    payload = {
        'model': model,
        'messages': [{'role': 'system', 'content': system_prompt}] + messages,
        'stream': False,
        'options': {
            'temperature': 0.7 if 'mistral' in model else 0.4 if 'codellama' in model else 0.6,
            'num_predict': 1024,
        }
    }

    try:
        response = requests.post(
            f'{OLLAMA_URL}/api/chat',
            json=payload,
            timeout=120
        )
        response.raise_for_status()
        data = response.json()
        content = data.get('message', {}).get('content', '')
        tokens = data.get('eval_count', 0) + data.get('prompt_eval_count', 0)
        return content, tokens, routing

    except requests.exceptions.ConnectionError:
        return "❌ Ollama is not running. Start it with: `ollama serve`", 0, routing
    except Exception as e:
        # Try fallback model
        if model != DEFAULT_MODEL:
            payload['model'] = DEFAULT_MODEL
            try:
                response = requests.post(f'{OLLAMA_URL}/api/chat', json=payload, timeout=120)
                data = response.json()
                content = data.get('message', {}).get('content', '')
                tokens = data.get('eval_count', 0) + data.get('prompt_eval_count', 0)
                routing['model'] = DEFAULT_MODEL
                routing['display_name'] = 'Llama 3.2 (fallback)'
                return content, tokens, routing
            except Exception:
                pass
        return f"❌ Error: {str(e)}", 0, routing


def get_model_stats() -> dict:
    """Get stats about available models."""
    installed = get_available_models()
    stats = []

    for model_id, info in AVAILABLE_MODELS.items():
        is_installed = any(model_id.split(':')[0] in m for m in installed)
        stats.append({
            'model_id': model_id,
            'display_name': info['display_name'],
            'icon': info['icon'],
            'description': info['description'],
            'strengths': info['strengths'],
            'speed': info['speed'],
            'quality': info['quality'],
            'installed': is_installed,
        })

    return {
        'models': stats,
        'installed_count': sum(1 for s in stats if s['installed']),
        'total_count': len(stats),
    }
