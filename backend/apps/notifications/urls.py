from django.urls import path

from .views import (
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
    NotificationPreferencesView,
)

urlpatterns = [
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("notifications/unread-count/", NotificationUnreadCountView.as_view(), name="notification-unread-count"),
    path("notifications/read-all/", NotificationMarkAllReadView.as_view(), name="notification-mark-all-read"),
    path("notifications/<uuid:pk>/read/", NotificationMarkReadView.as_view(), name="notification-mark-read"),
    path("notifications/preferences/", NotificationPreferencesView.as_view(), name="notification-preferences"),
]