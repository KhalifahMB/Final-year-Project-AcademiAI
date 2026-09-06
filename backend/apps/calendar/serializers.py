from rest_framework import serializers

from .models import CalendarEvent, CalendarSchedule, CalendarLayer


class CalendarEventSerializer(serializers.ModelSerializer):
    layer_label = serializers.SerializerMethodField()
    duration_minutes = serializers.ReadOnlyField()

    class Meta:
        model = CalendarEvent
        fields = [
            "id", "title", "description", "event_type", "layer", "layer_label",
            "start", "end", "all_day", "location", "venue", "course_code",
            "status", "visibility", "created_by", "user", "course_offering",
            "plan", "recur_rule", "reminders_minutes", "notify_enabled",
            "color", "metadata", "duration_minutes", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by", "user", "created_at", "updated_at"]

    def get_layer_label(self, obj):
        return dict(CalendarLayer.choices).get(obj.layer, obj.layer)


class CalendarEventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for calendar grid rendering."""
    layer = serializers.CharField()
    duration_minutes = serializers.ReadOnlyField()

    class Meta:
        model = CalendarEvent
        fields = [
            "id", "title", "event_type", "layer", "start", "end",
            "all_day", "venue", "course_code", "color", "status",
            "notify_enabled", "duration_minutes",
        ]


class CalendarScheduleSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CalendarSchedule
        fields = [
            "id", "import_type", "title", "description", "file_name",
            "source_format", "faculty", "department", "uploaded_by",
            "uploaded_by_name", "event_count", "error_count", "import_log",
            "committed", "created_at",
        ]
        read_only_fields = ["id", "uploaded_by", "uploaded_by_name", "event_count",
                            "error_count", "import_log", "committed", "created_at"]

    def get_uploaded_by_name(self, obj):
        user = obj.uploaded_by
        if user is None:
            return None
        return f"{user.first_name} {user.last_name}".strip() or user.email
