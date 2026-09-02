from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AgentStreamView, AgentToolListView, AgentSessionViewSet

router = DefaultRouter()
router.register(r"agent/sessions", AgentSessionViewSet, basename="agent-session")

urlpatterns = [
    path("agent/stream/", AgentStreamView.as_view(), name="agent-stream"),
    path("agent/tools/", AgentToolListView.as_view(), name="agent-tools"),
    path("", include(router.urls)),
]
