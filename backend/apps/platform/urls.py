from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AnnouncementViewSet, TenantAnnouncementsView

router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="platform-announcement")

urlpatterns = [
    path(
        "announcements/active/",
        TenantAnnouncementsView.as_view(),
        name="platform-announcements-active",
    ),
] + router.urls
