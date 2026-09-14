from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AgentAvatarUploadView,
    AgentIdentityListView,
    AgentSettingsView,
    AgentStreamView,
    AgentToolListView,
    AgentSessionViewSet,
)

router = DefaultRouter()
router.register(r"agent/sessions", AgentSessionViewSet, basename="agent-session")

urlpatterns = [
    path("agent/stream/", AgentStreamView.as_view(), name="agent-stream"),
    path("agent/tools/", AgentToolListView.as_view(), name="agent-tools"),
    path("agent/identities/", AgentIdentityListView.as_view(), name="agent-identities"),
    path("agent/settings/", AgentSettingsView.as_view(), name="agent-settings"),
    path("agent/avatar/", AgentAvatarUploadView.as_view(), name="agent-avatar"),
    path("", include(router.urls)),
]