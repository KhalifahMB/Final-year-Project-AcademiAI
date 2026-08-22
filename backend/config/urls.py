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

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.tenants.urls")),
    path("api/v1/", include("apps.academics.urls")),
    path("api/v1/", include("apps.resources.urls")),
    path("api/v1/", include("apps.knowledge.urls")),
    path("api/v1/", include("apps.chat.urls")),
    path("api/v1/", include("apps.assessments.urls")),
    path("api/v1/", include("apps.learning.urls")),
    path("api/v1/", include("apps.audit.urls")),
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

if settings.DEBUG:
    import debug_toolbar

    urlpatterns = [path("__debug__/", include(debug_toolbar.urls))] + urlpatterns
