from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AnnouncementViewSet,
    TenantAnnouncementsView,
    AnnouncementSubscriptionView,
)

router = DefaultRouter()
router.register("announcements", AnnouncementViewSet, basename="platform-announcement")

urlpatterns = [
    path(
        "announcements/active/",
        TenantAnnouncementsView.as_view(),
        name="platform-announcements-active",
    ),
    path(
        "announcements/subscriptions/",
        AnnouncementSubscriptionView.as_view(),
        name="platform-announcements-subscriptions",
    ),
] + router.urls
