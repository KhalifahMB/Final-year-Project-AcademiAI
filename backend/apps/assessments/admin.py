from django.contrib import admin
from .models import Quiz, QuizQuestion, QuizAttempt

class QuizQuestionInline(admin.TabularInline):
    model = QuizQuestion
    extra = 0

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ("title", "status", "course_offering", "created_by", "tenant")
    list_filter = ("status",)
    inlines = [QuizQuestionInline]

@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display = ("quiz", "student", "score", "submitted_at", "tenant")
