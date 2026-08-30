"""
User and profile models.
"""
import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.common.models import UUIDModel, TimeStampedModel


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_email_verified", True)
        # A superuser is platform-level and not scoped to a tenant, so no
        # tenant role is stamped by default.
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, UUIDModel, TimeStampedModel):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        LECTURER = "lecturer", "Lecturer"
        TENANT_ADMIN = "tenant_admin", "Tenant Admin"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"
        UNSPECIFIED = "unspecified", "Prefer not to say"

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        db_index=True,
    )
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    # Personal profile data (self-service editable).
    phone_number = models.CharField(max_length=32, blank=True)
    gender = models.CharField(
        max_length=20, choices=Gender.choices, blank=True, default=""
    )
    # Avatar: either a preset key (frontend-bundled artwork) or an uploaded
    # image stored under the tenant's object-storage partition.
    avatar_preset = models.CharField(max_length=32, blank=True)
    avatar_key = models.CharField(max_length=512, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "email"],
                name="uniq_user_email_per_tenant",
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "role"]),
        ]

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    @property
    def is_tenant_admin(self):
        return self.role == self.Role.TENANT_ADMIN


class StudentProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="student_profile"
    )
    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="student_profiles"
    )
    programme = models.ForeignKey(
        "academics.Programme",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    matric_number = models.CharField(max_length=50, blank=True)
    level = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        db_table = "student_profiles"


class LecturerProfile(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, primary_key=True, related_name="lecturer_profile"
    )
    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="lecturer_profiles"
    )
    department = models.ForeignKey(
        "academics.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lecturers",
    )
    staff_number = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "lecturer_profiles"


class EmailVerificationCode(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verification_codes")
    code_hash = models.CharField(max_length=128)  # store hash only
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "email_verification_codes"
        indexes = [models.Index(fields=["user", "is_used", "expires_at"])]


class PasswordResetToken(UUIDModel, TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = "password_reset_tokens"
