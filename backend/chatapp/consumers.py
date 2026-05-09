import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Conversation, Message, UsageLog
from .ollama_client import chat_with_ollama, detect_task_type


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'chat_{self.session_id}'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send(text_data=json.dumps({
            'type': 'connected',
            'message': 'WebSocket connected to ZeroTrace'
        }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message = data.get('message', '').strip()
            conversation_id = data.get('conversation_id')
            user = self.scope.get('user')

            if not message:
                return

            # Get or create conversation
            conversation = await self.get_or_create_conversation(user, conversation_id)

            # Save user message
            await self.save_message(conversation, 'user', message)

            # Get message history for context
            history = await self.get_history(conversation)

            # Detect task type
            task_type = detect_task_type(message)

            # Send task type info
            await self.send(text_data=json.dumps({
                'type': 'task_detected',
                'task_type': task_type,
                'conversation_id': conversation.id,
            }))

            # Stream response from Ollama
            full_response = ''
            for chunk in chat_with_ollama(history, stream=True):
                full_response += chunk
                await self.send(text_data=json.dumps({
                    'type': 'chunk',
                    'content': chunk,
                }))

            # Save assistant response
            tokens = len(full_response.split())
            await self.save_message(conversation, 'assistant', full_response, tokens)
            await self.log_usage(user, tokens, task_type)

            # Send completion signal
            await self.send(text_data=json.dumps({
                'type': 'done',
                'tokens': tokens,
                'conversation_id': conversation.id,
            }))

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    @database_sync_to_async
    def get_or_create_conversation(self, user, conversation_id):
        if conversation_id and user and user.is_authenticated:
            try:
                return Conversation.objects.get(id=conversation_id, user=user)
            except Conversation.DoesNotExist:
                pass
        if user and user.is_authenticated:
            return Conversation.objects.create(user=user)
        # Anonymous fallback (should not happen with JWT)
        return Conversation.objects.create(user=None) if False else Conversation.objects.create(user=user)

    @database_sync_to_async
    def save_message(self, conversation, role, content, tokens=0):
        return Message.objects.create(
            conversation=conversation,
            role=role,
            content=content,
            tokens_used=tokens,
        )

    @database_sync_to_async
    def get_history(self, conversation):
        messages = conversation.messages.order_by('created_at').values('role', 'content')
        return [{'role': m['role'], 'content': m['content']} for m in messages]

    @database_sync_to_async
    def log_usage(self, user, tokens, task_type):
        if user and user.is_authenticated:
            UsageLog.objects.create(user=user, tokens_used=tokens, task_type=task_type)
