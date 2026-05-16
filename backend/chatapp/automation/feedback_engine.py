"""
ZeroTrace Adaptive Feedback Engine
Re-ranks and prioritizes tasks based on execution outcomes.
This is the core novelty for the IEEE paper.
"""

import json
import os
import numpy as np
from datetime import datetime
from django.conf import settings

# Path to store feedback scores locally
FEEDBACK_FILE = os.path.join(
    os.path.dirname(__file__), '..', '..', 'generated_files', 'feedback_scores.json'
)


def load_scores() -> dict:
    """Load existing feedback scores from disk."""
    try:
        os.makedirs(os.path.dirname(FEEDBACK_FILE), exist_ok=True)
        if os.path.exists(FEEDBACK_FILE):
            with open(FEEDBACK_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return _default_scores()


def save_scores(scores: dict):
    """Persist feedback scores to disk."""
    try:
        os.makedirs(os.path.dirname(FEEDBACK_FILE), exist_ok=True)
        with open(FEEDBACK_FILE, 'w') as f:
            json.dump(scores, f, indent=2)
    except Exception as e:
        print(f"Failed to save scores: {e}")


def _default_scores() -> dict:
    """Default initial scores for all task types."""
    return {
        'email': {
            'success_count': 0,
            'failure_count': 0,
            'total_attempts': 0,
            'success_rate': 1.0,
            'priority_score': 1.0,
            'avg_execution_time': 0,
            'last_updated': None,
            'history': [],
        },
        'browser': {
            'success_count': 0,
            'failure_count': 0,
            'total_attempts': 0,
            'success_rate': 1.0,
            'priority_score': 1.0,
            'avg_execution_time': 0,
            'last_updated': None,
            'history': [],
        },
        'pdf': {
            'success_count': 0,
            'failure_count': 0,
            'total_attempts': 0,
            'success_rate': 1.0,
            'priority_score': 1.0,
            'avg_execution_time': 0,
            'last_updated': None,
            'history': [],
        },
        'research': {
            'success_count': 0,
            'failure_count': 0,
            'total_attempts': 0,
            'success_rate': 1.0,
            'priority_score': 1.0,
            'avg_execution_time': 0,
            'last_updated': None,
            'history': [],
        },
        'chat': {
            'success_count': 0,
            'failure_count': 0,
            'total_attempts': 0,
            'success_rate': 1.0,
            'priority_score': 1.0,
            'avg_execution_time': 0,
            'last_updated': None,
            'history': [],
        },
    }


def record_outcome(task_type: str, success: bool, execution_time_ms: float = 0):
    """
    Record the outcome of a task execution.
    Updates priority scores using exponential moving average.
    """
    scores = load_scores()

    if task_type not in scores:
        scores[task_type] = _default_scores().get('chat', {})

    task = scores[task_type]

    # Update counts
    task['total_attempts'] += 1
    if success:
        task['success_count'] += 1
    else:
        task['failure_count'] += 1

    # Calculate success rate
    task['success_rate'] = task['success_count'] / task['total_attempts']

    # Update average execution time (exponential moving average)
    alpha = 0.3  # smoothing factor
    if task['avg_execution_time'] == 0:
        task['avg_execution_time'] = execution_time_ms
    else:
        task['avg_execution_time'] = (
            alpha * execution_time_ms + (1 - alpha) * task['avg_execution_time']
        )

    # Compute new priority score using numpy
    # Priority = success_rate * recency_weight * reliability_factor
    success_history = [h['success'] for h in task.get('history', [])][-10:]
    success_history.append(success)

    if len(success_history) >= 2:
        # Give more weight to recent outcomes
        weights = np.exp(np.linspace(0, 1, len(success_history)))
        weights = weights / weights.sum()
        weighted_success = np.average(success_history, weights=weights)
        task['priority_score'] = float(weighted_success)
    else:
        task['priority_score'] = 1.0 if success else 0.5

    # Add to history (keep last 20)
    task['history'].append({
        'success': success,
        'time_ms': execution_time_ms,
        'timestamp': datetime.now().isoformat(),
    })
    task['history'] = task['history'][-20:]
    task['last_updated'] = datetime.now().isoformat()

    scores[task_type] = task
    save_scores(scores)

    return task['priority_score']


def get_priority_scores() -> dict:
    """Get current priority scores for all task types."""
    scores = load_scores()
    return {
        task_type: {
            'priority_score': round(data.get('priority_score', 1.0), 3),
            'success_rate': round(data.get('success_rate', 1.0), 3),
            'total_attempts': data.get('total_attempts', 0),
            'success_count': data.get('success_count', 0),
            'failure_count': data.get('failure_count', 0),
            'avg_execution_time': round(data.get('avg_execution_time', 0), 1),
            'last_updated': data.get('last_updated'),
        }
        for task_type, data in scores.items()
    }


def rank_tasks(task_list: list) -> list:
    """
    Re-rank a list of tasks based on their priority scores.
    Tasks with higher success rates get executed first.

    task_list: list of dicts with 'type' and 'description' keys
    Returns: sorted list with highest priority first
    """
    scores = load_scores()

    def get_score(task):
        task_type = task.get('type', 'chat')
        if task_type in scores:
            return scores[task_type].get('priority_score', 1.0)
        return 1.0

    return sorted(task_list, key=get_score, reverse=True)


def get_recommendation(task_type: str) -> dict:
    """
    Get a recommendation for how to handle a task based on past performance.
    If success rate is low, suggest alternatives or retry strategies.
    """
    scores = load_scores()
    task = scores.get(task_type, {})
    success_rate = task.get('success_rate', 1.0)
    total_attempts = task.get('total_attempts', 0)

    if total_attempts < 3:
        return {
            'recommendation': 'proceed',
            'message': 'Not enough data yet — proceeding normally.',
            'confidence': 'low',
        }

    if success_rate >= 0.85:
        return {
            'recommendation': 'proceed',
            'message': f'{task_type.title()} tasks have a {success_rate:.0%} success rate — high confidence.',
            'confidence': 'high',
        }
    elif success_rate >= 0.6:
        return {
            'recommendation': 'proceed_with_caution',
            'message': f'{task_type.title()} tasks have a {success_rate:.0%} success rate — will retry if needed.',
            'confidence': 'medium',
        }
    else:
        return {
            'recommendation': 'alternative',
            'message': f'{task_type.title()} tasks have been failing ({success_rate:.0%} rate) — trying alternative approach.',
            'confidence': 'low',
        }


def adaptive_execute(user_message: str, ai_response: str = '') -> dict:
    """
    Execute automation with adaptive feedback.
    Records outcomes and adjusts future priorities.
    """
    import time
    from chatapp.nlp_parser import parse_intent
    from chatapp.automation.task_executor import detect_and_execute

    # Parse intent
    parsed = parse_intent(user_message)
    task_type = parsed.intent

    # Get recommendation based on history
    recommendation = get_recommendation(task_type)

    # Execute the task
    start_time = time.time()
    result = detect_and_execute(user_message, ai_response)
    execution_time = (time.time() - start_time) * 1000  # ms

    # Determine success
    if result['executed']:
        success = '❌' not in result.get('result', '') and 'error' not in result.get('result', '').lower()
        record_outcome(task_type, success, execution_time)

        # Add feedback info to result
        new_score = get_priority_scores().get(task_type, {})
        result['feedback'] = {
            'task_type': task_type,
            'success': success,
            'execution_time_ms': round(execution_time, 1),
            'new_priority_score': new_score.get('priority_score', 1.0),
            'success_rate': new_score.get('success_rate', 1.0),
            'recommendation': recommendation,
        }
    else:
        # Record chat interaction
        record_outcome('chat', True, execution_time)

    return result
