"""
Root URL configuration.
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from apps.tenants.stats import PublicStatsView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls"),name="accounts"),
    path("api/v1/", include("apps.tenants.urls"),name="tenants"),
    path("api/v1/", include("apps.academics.urls"), name="academics"),
    path("api/v1/", include("apps.resources.urls"), name="resources"),
    path("api/v1/", include("apps.knowledge.urls"), name="knowledge"),
    path("api/v1/", include("apps.chat.urls"), name="chats"),
    path("api/v1/", include("apps.assessments.urls"), name="assessments"),
    path("api/v1/", include("apps.learning.urls"), name="learning"),
    path("api/v1/", include("apps.audit.urls"), name="audit"),
    path("api/v1/", include("apps.common.urls"), name="common"),
    path("api/v1/", include("apps.platform.urls"), name="platform"),
    path("api/v1/", include("apps.logs.urls"), name="logs"),
    path("api/v1/", include("apps.agent.urls"), name="agent"),
    path("api/v1/", include("apps.calendar.urls"), name="calendar"),
    path("api/v1/", include("apps.notifications.urls"), name="notifications"),
    path("api/public/stats/", PublicStatsView.as_view(), name="public-stats"),
    # OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
]

if settings.DEBUG and not getattr(settings, "TESTING", False):
    # Serve user uploads (custom agent avatars etc.) in development.
    from django.conf.urls.static import static

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
