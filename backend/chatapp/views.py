from django.contrib.auth.models import User
from django.db.models import Sum
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.http import StreamingHttpResponse
import json

from .models import Conversation, Message, UsageLog
from .serializers import (
    RegisterSerializer, UserSerializer,
    ConversationSerializer, ConversationListSerializer,
    MessageSerializer, UsageLogSerializer
)
from .ollama_client import chat_with_ollama, check_ollama_status, detect_task_type
from .automation.task_executor import detect_and_execute


# ─────────────────────────────────────────────
# AUTH VIEWS
# ─────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')

        if '@' in str(username):
            user_obj = User.objects.filter(email=username).first()
            if user_obj:
                username = user_obj.username
            else:
                return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# ─────────────────────────────────────────────
# CHAT VIEW (with automation)
# ─────────────────────────────────────────────

class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_message = request.data.get('message', '').strip()
        conversation_id = request.data.get('conversation_id')

        if not user_message:
            return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get or create conversation
        if conversation_id:
            try:
                conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            except Conversation.DoesNotExist:
                conversation = Conversation.objects.create(user=request.user)
        else:
            conversation = Conversation.objects.create(user=request.user)

        # Save user message
        Message.objects.create(conversation=conversation, role='user', content=user_message)

        if not conversation.title:
            conversation.title = user_message[:60]
            conversation.save()

        # Build history for Ollama
        history = list(conversation.messages.order_by('created_at').values('role', 'content'))
        ollama_messages = [{'role': m['role'], 'content': m['content']} for m in history]

        task_type = detect_task_type(user_message)

        # Get AI response
        ai_response, tokens = chat_with_ollama(ollama_messages, stream=False)

        # Check if automation should be executed
        automation = detect_and_execute(user_message, ai_response)

        # Build final response
        if automation['executed']:
            final_response = f"{ai_response}\n\n---\n\n🤖 **Automation executed:**\n\n{automation['result']}"
            task_type = automation['task_type']
        else:
            final_response = ai_response

        # Save assistant message
        msg = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=final_response,
            tokens_used=tokens,
        )

        # Log usage
        UsageLog.objects.create(user=request.user, tokens_used=tokens, task_type=task_type)

        return Response({
            'message': final_response,
            'tokens': tokens,
            'conversation_id': conversation.id,
            'message_id': msg.id,
            'task_type': task_type,
            'automation': automation,
        })


class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversation_id = request.query_params.get('conversation_id')
        if not conversation_id:
            return Response({'error': 'conversation_id required'}, status=400)
        try:
            conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            messages = conversation.messages.all()
            return Response(MessageSerializer(messages, many=True).data)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)


# ─────────────────────────────────────────────
# CONVERSATION VIEWS
# ─────────────────────────────────────────────

class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = Conversation.objects.filter(user=request.user)
        return Response(ConversationListSerializer(conversations, many=True).data)

    def post(self, request):
        conversation = Conversation.objects.create(user=request.user)
        return Response(ConversationListSerializer(conversation).data, status=201)


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk, user=request.user)
            return Response(ConversationSerializer(conversation).data)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

    def delete(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk, user=request.user)
            conversation.delete()
            return Response(status=204)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)


# ─────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────

class UsageStatsView(APIView):
    permission_classes = [IsAuthenticated]
    GPT4_COST_PER_1K_INR = 2.5

    def get(self, request):
        logs = UsageLog.objects.filter(user=request.user)
        total_tokens = logs.aggregate(total=Sum('tokens_used'))['total'] or 0
        total_conversations = Conversation.objects.filter(user=request.user).count()
        total_messages = Message.objects.filter(conversation__user=request.user).count()
        cost_saved = round((total_tokens / 1000) * self.GPT4_COST_PER_1K_INR, 2)

        task_breakdown = {}
        for task in ['chat', 'research', 'pdf', 'email', 'browser', 'pdf+email']:
            task_breakdown[task] = logs.filter(task_type=task).count()

        return Response({
            'total_tokens': total_tokens,
            'total_conversations': total_conversations,
            'total_messages': total_messages,
            'cost_saved_inr': cost_saved,
            'cost_saved_vs_gpt4': f'₹{cost_saved}',
            'task_breakdown': task_breakdown,
            'model': 'llama3.2:latest',
            'api_cost': '₹0.00',
        })


# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────

class OllamaStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(check_ollama_status())