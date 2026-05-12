"""
ZeroTrace Celery Tasks
All automation tasks that run asynchronously in the background.
"""

from celery import shared_task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)


@shared_task(bind=True, name='chatapp.tasks.run_email_task')
def run_email_task(self, to_email: str, subject: str, body: str, attachment_path: str = None):
    """Send email asynchronously."""
    try:
        self.update_state(state='PROGRESS', meta={'status': 'Connecting to Gmail SMTP...'})
        from chatapp.automation.email_sender import send_email
        success, message = send_email(
            to_email=to_email,
            subject=subject,
            body=body,
            attachment_path=attachment_path,
        )
        if success:
            return {'status': 'SUCCESS', 'message': message, 'to': to_email}
        else:
            raise Exception(message)
    except Exception as e:
        logger.error(f'Email task failed: {e}')
        raise


@shared_task(bind=True, name='chatapp.tasks.run_browser_task')
def run_browser_task(self, command: str):
    """Run browser automation asynchronously."""
    try:
        self.update_state(state='PROGRESS', meta={'status': 'Opening Chrome browser...'})
        from chatapp.automation.browser_automation import execute_browser_command
        result = execute_browser_command(command)
        if result['success']:
            return {'status': 'SUCCESS', 'summary': result.get('summary', ''), 'steps': result.get('steps', [])}
        else:
            raise Exception(result.get('error', 'Browser task failed'))
    except Exception as e:
        logger.error(f'Browser task failed: {e}')
        raise


@shared_task(bind=True, name='chatapp.tasks.run_pdf_task')
def run_pdf_task(self, title: str, content: str):
    """Generate PDF asynchronously."""
    try:
        self.update_state(state='PROGRESS', meta={'status': 'Generating PDF...'})
        from chatapp.automation.pdf_generator import generate_pdf
        success, filepath, message = generate_pdf(title, content)
        if success:
            return {'status': 'SUCCESS', 'filepath': filepath, 'message': message}
        else:
            raise Exception(message)
    except Exception as e:
        logger.error(f'PDF task failed: {e}')
        raise


@shared_task(bind=True, name='chatapp.tasks.run_research_task')
def run_research_task(self, topic: str, to_email: str = None):
    """Run full research pipeline asynchronously."""
    try:
        self.update_state(state='PROGRESS', meta={'status': f'Searching for: {topic}...'})
        from chatapp.automation.research_engine import run_research
        result = run_research(topic=topic, to_email=to_email)
        return {
            'status': 'SUCCESS',
            'topic': topic,
            'summary': result.get('summary', ''),
            'pdf_path': result.get('pdf_path'),
            'email_sent': result.get('email_sent', False),
            'sources_count': result.get('sources_count', 0),
        }
    except Exception as e:
        logger.error(f'Research task failed: {e}')
        raise


@shared_task(bind=True, name='chatapp.tasks.run_automation_pipeline')
def run_automation_pipeline(self, user_message: str, ai_response: str = ''):
    """
    Run full automation pipeline asynchronously.
    This is the main task that handles all automation types.
    """
    try:
        self.update_state(state='PROGRESS', meta={'status': 'Analyzing request with spaCy NLP...'})

        from chatapp.nlp_parser import parse_intent
        parsed = parse_intent(user_message)

        self.update_state(state='PROGRESS', meta={
            'status': f'Intent detected: {parsed.intent}. Executing...',
            'intent': parsed.intent,
        })

        from chatapp.automation.task_executor import detect_and_execute
        result = detect_and_execute(user_message, ai_response)

        return {
            'status': 'SUCCESS',
            'executed': result['executed'],
            'task_type': result['task_type'],
            'result': result['result'],
            'steps': result.get('steps', []),
            'nlp_intent': parsed.intent,
            'nlp_confidence': parsed.confidence,
        }
    except Exception as e:
        logger.error(f'Automation pipeline failed: {e}')
        raise


@shared_task(name='chatapp.tasks.get_task_status')
def get_task_status(task_id: str):
    """Get status of a running task."""
    from celery.result import AsyncResult
    result = AsyncResult(task_id)
    return {
        'task_id': task_id,
        'status': result.status,
        'result': result.result if result.ready() else None,
        'info': result.info,
    }
