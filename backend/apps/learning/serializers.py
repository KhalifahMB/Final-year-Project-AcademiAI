from rest_framework import serializers
from .models import Note, Bookmark, ProgressRecord

class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = ("id", "title", "content", "resource", "user", "tenant", "created_at", "updated_at")
        read_only_fields = ("id", "user", "tenant", "created_at", "updated_at")

class BookmarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bookmark
        fields = ("id", "resource", "user", "tenant", "created_at")
        read_only_fields = ("id", "user", "tenant", "created_at")

class ProgressRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressRecord
        fields = ("id", "concept", "progress_value", "last_seen_at", "user", "tenant")
        read_only_fields = ("id", "user", "tenant", "last_seen_at")
