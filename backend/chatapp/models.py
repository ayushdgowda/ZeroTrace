from django.db import models
from django.contrib.auth.models import User


class Conversation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations')
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.user.username} - {self.title or 'Untitled'}"

    def auto_title(self):
        first = self.messages.filter(role='user').first()
        if first:
            self.title = first.content[:60]
            self.save()


class Message(models.Model):
    ROLE_CHOICES = [('user', 'User'), ('assistant', 'Assistant')]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    tokens_used = models.IntegerField(default=0)
    model_used = models.CharField(max_length=50, default='llama3.2')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"[{self.role}] {self.content[:50]}"


class UsageLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='usage_logs')
    tokens_used = models.IntegerField(default=0)
    model_used = models.CharField(max_length=50, default='llama3.2')
    task_type = models.CharField(max_length=50, default='chat')  # chat, research, pdf, email
    created_at = models.DateTimeField(auto_now_add=True)

    # Cost comparison (GPT-4 is ~$0.03 per 1K tokens = ~₹2.5 per 1K tokens)
    GPT4_COST_PER_1K_TOKENS_INR = 2.5

    @property
    def cost_saved_inr(self):
        return round((self.tokens_used / 1000) * self.GPT4_COST_PER_1K_TOKENS_INR, 2)

    def __str__(self):
        return f"{self.user.username} - {self.tokens_used} tokens"
