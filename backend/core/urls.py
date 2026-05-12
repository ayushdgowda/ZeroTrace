from django.contrib import admin
from chatapp.views import TaskStatusView
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from chatapp.views import (
    RegisterView, LoginView, ChatView, ChatHistoryView,
    ConversationListView, ConversationDetailView,
    UsageStatsView, OllamaStatusView, NLPAnalyzeView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Chat
    path('api/chat/', ChatView.as_view(), name='chat'),
    path('api/chat/history/', ChatHistoryView.as_view(), name='chat_history'),

    # Conversations
    path('api/conversations/', ConversationListView.as_view(), name='conversations'),
    path('api/conversations/<int:pk>/', ConversationDetailView.as_view(), name='conversation_detail'),

    # Analytics
    path('api/usage/', UsageStatsView.as_view(), name='usage_stats'),

    # NLP Analysis
    path('api/nlp/analyze/', NLPAnalyzeView.as_view(), name='nlp_analyze'),

    # Status
    path('api/status/', OllamaStatusView.as_view(), name='ollama_status'),

    path('api/tasks/<str:task_id>/', TaskStatusView.as_view(), name='task_status'),
]