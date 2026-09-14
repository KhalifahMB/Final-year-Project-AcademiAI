from django.apps import AppConfig


class CalendarConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.calendar"
    label = "calendar"

    def ready(self):
        import apps.calendar.signals  # noqa: F401
