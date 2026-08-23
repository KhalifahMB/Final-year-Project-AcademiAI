from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatSessionViewSet, ChatMessageViewSet, ChatSendMessageView

router = DefaultRouter()
router.register("chat/sessions", ChatSessionViewSet, basename="chat-session")
router.register("chat/messages", ChatMessageViewSet, basename="chat-message")

urlpatterns = [
    path(
        "chat/sessions/<uuid:session_id>/messages/",
        ChatSendMessageView.as_view(),
        name="chat-send-message",
    ),
    path("", include(router.urls)),
]
