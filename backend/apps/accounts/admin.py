from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StudentProfile, LecturerProfile

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "role", "tenant", "is_email_verified", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_email_verified")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("first_name", "last_name", "role", "tenant")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "is_email_verified", "groups", "user_permissions")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role", "tenant")}),
    )
    filter_horizontal = ("groups", "user_permissions")

admin.site.register(StudentProfile)
admin.site.register(LecturerProfile)
