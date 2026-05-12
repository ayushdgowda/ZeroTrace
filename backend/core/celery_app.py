"""
ZeroTrace Celery Configuration
Async task queue for background automation tasks.
"""

import os
from celery import Celery

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('zerotrace')

# Load config from Django settings
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

# Task routing
app.conf.task_routes = {
    'chatapp.tasks.*': {'queue': 'automation'},
}

# Task settings
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Kolkata',
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
