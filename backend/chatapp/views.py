from django.contrib.auth.models import User
from django.db.models import Sum
from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from celery.result import AsyncResult
import os

from .models import Conversation, Message, UsageLog
from .serializers import (
    RegisterSerializer, UserSerializer,
    ConversationSerializer, ConversationListSerializer,
    MessageSerializer,
)
from .ollama_client import chat_with_ollama, check_ollama_status
from .nlp_parser import parse_intent, get_nlp_summary
from .automation.feedback_engine import (
    adaptive_execute, get_priority_scores,
    record_outcome, get_recommendation
)


# ─────────────────────────────────────────────
# AUTH
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
# CHAT (with adaptive feedback)
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

        # spaCy NLP parsing
        parsed = parse_intent(user_message)
        task_type = parsed.intent

        # Build history for Ollama
        history = list(conversation.messages.order_by('created_at').values('role', 'content'))
        ollama_messages = [{'role': m['role'], 'content': m['content']} for m in history]

        # Get AI response
        ai_response, tokens = chat_with_ollama(ollama_messages, stream=False)

        # Run automation with ADAPTIVE FEEDBACK
        automation = adaptive_execute(user_message, ai_response)

        # Build final response
        final_response = ai_response
        if automation.get('executed'):
            final_response += f'\n\n---\n\n🤖 **Automation executed:**\n\n{automation["result"]}'
            task_type = automation.get('task_type', task_type)

            # Add feedback info if available
            feedback = automation.get('feedback', {})
            if feedback:
                score = feedback.get('new_priority_score', 1.0)
                success = feedback.get('success', True)
                final_response += f'\n\n> 🧠 **Adaptive Feedback:** {"✅ Success" if success else "❌ Failed"} · Priority score updated to `{score:.2f}` · System will optimize future {task_type} tasks automatically.'

        # Save assistant message
        msg = Message.objects.create(
            conversation=conversation,
            role='assistant',
            content=final_response,
            tokens_used=tokens,
        )

        # Log usage
        UsageLog.objects.create(
            user=request.user,
            tokens_used=tokens,
            task_type=task_type,
        )

        return Response({
            'message': final_response,
            'tokens': tokens,
            'conversation_id': conversation.id,
            'message_id': msg.id,
            'task_type': task_type,
            'automation': automation,
            'nlp': parsed.to_dict(),
            'feedback': automation.get('feedback', {}),
        })


class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversation_id = request.query_params.get('conversation_id')
        if not conversation_id:
            return Response({'error': 'conversation_id required'}, status=400)
        try:
            conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            return Response(MessageSerializer(conversation.messages.all(), many=True).data)
        except Conversation.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)


# ─────────────────────────────────────────────
# NLP
# ─────────────────────────────────────────────

class NLPAnalyzeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        text = request.data.get('text', '')
        if not text:
            return Response({'error': 'text required'}, status=400)
        parsed = parse_intent(text)
        return Response({
            'parsed': parsed.to_dict(),
            'summary': get_nlp_summary(parsed),
        })


# ─────────────────────────────────────────────
# ADAPTIVE FEEDBACK
# ─────────────────────────────────────────────

class FeedbackScoresView(APIView):
    """Get current adaptive feedback scores for all task types."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        scores = get_priority_scores()
        return Response({
            'scores': scores,
            'description': 'Priority scores computed using exponential moving average of task outcomes.',
        })

    def post(self, request):
        """Manually record a task outcome."""
        task_type = request.data.get('task_type')
        success = request.data.get('success', True)
        execution_time = request.data.get('execution_time_ms', 0)

        if not task_type:
            return Response({'error': 'task_type required'}, status=400)

        new_score = record_outcome(task_type, success, execution_time)
        recommendation = get_recommendation(task_type)

        return Response({
            'task_type': task_type,
            'new_priority_score': new_score,
            'recommendation': recommendation,
        })


# ─────────────────────────────────────────────
# PDF DOWNLOAD
# ─────────────────────────────────────────────

class PDFDownloadView(APIView):
    """Download a generated PDF file."""
    permission_classes = [IsAuthenticated]

    def get(self, request, filename):
        # Security: only allow PDF files from generated_files directory
        safe_filename = os.path.basename(filename)
        if not safe_filename.endswith('.pdf'):
            raise Http404('Only PDF files can be downloaded')

        base_dir = os.path.join(
            os.path.dirname(__file__), '..', 'generated_files'
        )
        file_path = os.path.join(base_dir, safe_filename)
        file_path = os.path.normpath(file_path)

        if not os.path.exists(file_path):
            raise Http404(f'PDF not found: {safe_filename}')

        response = FileResponse(
            open(file_path, 'rb'),
            content_type='application/pdf',
        )
        response['Content-Disposition'] = f'attachment; filename="{safe_filename}"'
        return response


class PDFListView(APIView):
    """List all generated PDFs."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base_dir = os.path.join(
            os.path.dirname(__file__), '..', 'generated_files'
        )
        os.makedirs(base_dir, exist_ok=True)

        pdfs = []
        for filename in os.listdir(base_dir):
            if filename.endswith('.pdf'):
                file_path = os.path.join(base_dir, filename)
                size_kb = round(os.path.getsize(file_path) / 1024, 1)
                modified = os.path.getmtime(file_path)
                pdfs.append({
                    'filename': filename,
                    'size_kb': size_kb,
                    'modified': modified,
                    'download_url': f'/api/pdf/download/{filename}/',
                })

        pdfs.sort(key=lambda x: x['modified'], reverse=True)
        return Response({'pdfs': pdfs, 'count': len(pdfs)})


# ─────────────────────────────────────────────
# CONVERSATIONS
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
# TASK STATUS (Celery)
# ─────────────────────────────────────────────

class TaskStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        result = AsyncResult(task_id)
        data = {
            'task_id': task_id,
            'status': result.status,
            'ready': result.ready(),
        }
        if result.status == 'PROGRESS':
            data['info'] = result.info
        elif result.status == 'SUCCESS':
            data['result'] = result.result
        elif result.status == 'FAILURE':
            data['error'] = str(result.result)
        return Response(data)


# ─────────────────────────────────────────────
# STATUS
# ─────────────────────────────────────────────

class OllamaStatusView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(check_ollama_status())