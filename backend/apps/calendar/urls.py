"""
Calendar URL configuration.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CalendarEventViewSet, CalendarScheduleViewSet

router = DefaultRouter()
router.register(r"calendar/events", CalendarEventViewSet, basename="calendar-event")
router.register(r"calendar/schedules", CalendarScheduleViewSet, basename="calendar-schedule")

urlpatterns = [path("", include(router.urls))]
