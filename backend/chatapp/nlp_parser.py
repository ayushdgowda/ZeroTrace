"""
ZeroTrace NLP Intent Parser
Uses spaCy for intent classification and entity extraction.
This replaces simple keyword matching with proper NLP pipeline.
"""

import spacy
import re
from dataclasses import dataclass, field
from typing import Optional

# Load spaCy model
try:
    nlp = spacy.load('en_core_web_sm')
except OSError:
    import subprocess
    subprocess.run(['python', '-m', 'spacy', 'download', 'en_core_web_sm'])
    nlp = spacy.load('en_core_web_sm')


# ─── Intent definitions ───────────────────────────────────────────────────────

INTENT_PATTERNS = {
    'email': {
        'verbs': ['send', 'email', 'mail', 'forward', 'reply', 'compose'],
        'nouns': ['email', 'mail', 'message', 'gmail'],
        'keywords': ['send this to', 'email to', 'mail to', 'send to'],
    },
    'browser': {
        'verbs': ['search', 'find', 'open', 'browse', 'navigate', 'visit', 'go', 'look'],
        'nouns': ['google', 'chrome', 'browser', 'website', 'youtube', 'url'],
        'keywords': ['search google', 'google for', 'open chrome', 'go to', 'search for'],
    },
    'pdf': {
        'verbs': ['create', 'generate', 'make', 'write', 'produce', 'convert'],
        'nouns': ['pdf', 'document', 'report', 'file'],
        'keywords': ['create pdf', 'make pdf', 'generate pdf', 'write pdf'],
    },
    'research': {
        'verbs': ['research', 'investigate', 'analyze', 'gather', 'study', 'summarize'],
        'nouns': ['research', 'report', 'analysis', 'information', 'data'],
        'keywords': ['research', 'find information', 'write a report', 'gather data'],
    },
    'schedule': {
        'verbs': ['schedule', 'remind', 'set', 'plan', 'automate'],
        'nouns': ['schedule', 'reminder', 'alarm', 'task', 'event'],
        'keywords': ['every day', 'every week', 'remind me', 'schedule this'],
    },
    'file': {
        'verbs': ['organize', 'rename', 'move', 'copy', 'delete', 'manage'],
        'nouns': ['file', 'folder', 'directory', 'document', 'downloads'],
        'keywords': ['organize files', 'rename files', 'move files'],
    },
    'chat': {
        'verbs': ['explain', 'tell', 'describe', 'help', 'what', 'how', 'why'],
        'nouns': ['explanation', 'help', 'advice', 'information'],
        'keywords': [],
    },
}


@dataclass
class ParsedIntent:
    """Structured result from NLP parsing."""
    intent: str = 'chat'
    confidence: float = 0.0
    entities: dict = field(default_factory=dict)
    action_verb: Optional[str] = None
    subject: Optional[str] = None
    raw_text: str = ''

    # Extracted specific fields
    email_address: Optional[str] = None
    url: Optional[str] = None
    topic: Optional[str] = None
    person_name: Optional[str] = None
    organization: Optional[str] = None

    def to_dict(self):
        return {
            'intent': self.intent,
            'confidence': round(self.confidence, 2),
            'entities': self.entities,
            'action_verb': self.action_verb,
            'subject': self.subject,
            'email_address': self.email_address,
            'url': self.url,
            'topic': self.topic,
            'person_name': self.person_name,
            'organization': self.organization,
        }


def parse_intent(text: str) -> ParsedIntent:
    """
    Main NLP parsing function.
    Takes user message and returns structured ParsedIntent.
    """
    result = ParsedIntent(raw_text=text)
    doc = nlp(text.lower())

    # ── Extract entities using spaCy NER ─────────────────
    entities = {}
    for ent in doc.ents:
        entities[ent.label_] = entities.get(ent.label_, [])
        entities[ent.label_].append(ent.text)

    result.entities = entities

    # Extract person names
    if 'PERSON' in entities:
        result.person_name = entities['PERSON'][0]

    # Extract organizations
    if 'ORG' in entities:
        result.organization = entities['ORG'][0]

    # ── Extract email address ─────────────────────────────
    email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    if email_match:
        result.email_address = email_match.group(0)

    # ── Extract URL ───────────────────────────────────────
    url_match = re.search(r'https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?', text)
    if url_match:
        url = url_match.group(0)
        if not url.startswith('http'):
            url = 'https://' + url
        result.url = url

    # ── Extract action verb ───────────────────────────────
    for token in doc:
        if token.pos_ == 'VERB' and token.dep_ in ['ROOT', 'xcomp', 'advcl']:
            result.action_verb = token.lemma_
            break

    # ── Score each intent ─────────────────────────────────
    scores = {}
    text_lower = text.lower()
    doc_tokens = [token.lemma_ for token in doc]

    for intent, patterns in INTENT_PATTERNS.items():
        score = 0.0

        # Check keywords (highest weight)
        for kw in patterns['keywords']:
            if kw in text_lower:
                score += 3.0

        # Check verbs
        for verb in patterns['verbs']:
            if verb in doc_tokens:
                score += 2.0

        # Check nouns
        for noun in patterns['nouns']:
            if noun in text_lower:
                score += 1.5

        # Boost email intent if email address found
        if intent == 'email' and result.email_address:
            score += 2.0

        # Boost browser if URL found
        if intent == 'browser' and result.url:
            score += 1.5

        scores[intent] = score

    # Pick highest scoring intent
    best_intent = max(scores, key=scores.get)
    best_score = scores[best_intent]

    # Only assign non-chat intent if score is high enough
    if best_score >= 1.5:
        result.intent = best_intent
        result.confidence = min(best_score / 10.0, 1.0)
    else:
        result.intent = 'chat'
        result.confidence = 0.9

    # ── Extract topic ─────────────────────────────────────
    result.topic = extract_topic(text, result.intent)

    return result


def extract_topic(text: str, intent: str) -> str:
    """Extract the main topic/subject from the message."""
    text_clean = text

    # Remove trigger phrases based on intent
    remove_phrases = {
        'research': ['research', 'find information about', 'write a report on',
                     'gather data on', 'investigate', 'analyze', 'summarize'],
        'browser': ['search google for', 'google search for', 'search for',
                    'google for', 'find on google', 'look up', 'search'],
        'email': ['send this to', 'email to', 'send email to', 'mail to'],
        'pdf': ['create a pdf about', 'make a pdf about', 'generate a pdf about',
                'write a pdf on', 'create pdf', 'make pdf'],
    }

    phrases = remove_phrases.get(intent, [])
    for phrase in sorted(phrases, key=len, reverse=True):
        text_clean = re.sub(re.escape(phrase), '', text_clean, flags=re.IGNORECASE)

    # Remove email addresses from topic
    text_clean = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '', text_clean)

    # Remove common filler words
    text_clean = re.sub(r'\b(and|send|the|report|to|me|my|please|can|you)\b', '', text_clean, flags=re.IGNORECASE)

    topic = text_clean.strip(' .,:-')
    return topic if topic else text


def get_nlp_summary(parsed: ParsedIntent) -> str:
    """Generate a human-readable summary of NLP parsing."""
    lines = [
        f"**🧠 NLP Analysis (spaCy)**",
        f"- **Intent detected:** `{parsed.intent}` (confidence: {parsed.confidence:.0%})",
        f"- **Action verb:** `{parsed.action_verb or 'none'}`",
        f"- **Topic:** {parsed.topic or 'N/A'}",
    ]
    if parsed.email_address:
        lines.append(f"- **Email target:** `{parsed.email_address}`")
    if parsed.url:
        lines.append(f"- **URL:** `{parsed.url}`")
    if parsed.person_name:
        lines.append(f"- **Person:** {parsed.person_name}")
    if parsed.organization:
        lines.append(f"- **Organization:** {parsed.organization}")
    if parsed.entities:
        ent_str = ', '.join([f"{k}: {v}" for k, v in parsed.entities.items()])
        lines.append(f"- **Named entities:** {ent_str}")
    return '\n'.join(lines)


def batch_parse(texts: list) -> list:
    """Parse multiple texts at once using spaCy's pipe for efficiency."""
    results = []
    for doc in nlp.pipe([t.lower() for t in texts]):
        results.append(doc)
    return results
