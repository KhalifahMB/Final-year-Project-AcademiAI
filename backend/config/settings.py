"""
AcademiAI Django settings.
Environment-driven. Never commit real secrets.
"""
import os
import sys
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Debug Toolbar must never load under pytest (it interferes with the test client).
TESTING = "pytest" in sys.modules

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

# Fail fast rather than boot production with a publicly-known key.
if not DEBUG and SECRET_KEY.startswith("django-insecure-dev-only"):
    raise RuntimeError(
        "DJANGO_SECRET_KEY must be set to a strong random value when DEBUG=False."
    )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "corsheaders",
    "django_filters",
    "storages",
    # Project apps
    "apps.common",
    "apps.tenants",
    "apps.accounts",
    "apps.academics",
    "apps.resources",
    "apps.knowledge",
    "apps.chat",
    "apps.assessments",
    "apps.learning",
    "apps.audit",
    "apps.platform",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.common.middleware.TenantContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

if DEBUG and not TESTING:
    INSTALLED_APPS.append("debug_toolbar")
    MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# Database
# POSTGRES_USER must be a non-superuser WITHOUT BYPASSRLS so that
# PostgreSQL Row-Level Security is genuinely enforced (see
# infrastructure/postgres/init/01-app-role.sql).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "academiai"),
        "USER": os.getenv("POSTGRES_USER", "academiai_app"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "academiai_app"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
        "OPTIONS": {"options": "-c search_path=public"},
    }
}

# Custom user
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "DJANGO_CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
# CORS — JWT travels in the Authorization header, not cookies, so
# credentialed CORS is neither needed nor allowed.
CORS_ALLOW_CREDENTIALS = False
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]

# DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.custom_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "2000/hour",
        "auth": "20/minute",
        "ai": "30/minute",
        "upload": "20/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("SIMPLE_JWT_ACCESS_TOKEN_LIFETIME_MINUTES", "60"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("SIMPLE_JWT_REFRESH_TOKEN_LIFETIME_DAYS", "7"))
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "AcademiAI API",
    "DESCRIPTION": "Multi-tenant academic AI platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "TAGS": [
        {"name": "Authentication", "description": "Signup, verification, login, tokens, password management"},
        {"name": "Users", "description": "Tenant user administration (admins)"},
        {"name": "Tenants", "description": "Institution (tenant) management"},
        {"name": "Faculties", "description": "Faculty structure"},
        {"name": "Departments", "description": "Department structure"},
        {"name": "Programmes", "description": "Programme structure"},
        {"name": "Academic Sessions", "description": "Academic year definitions"},
        {"name": "Semesters", "description": "Semester calendar within sessions"},
        {"name": "Courses", "description": "Reusable course catalogue"},
        {"name": "Course Offerings", "description": "Course delivery per session/semester"},
        {"name": "Lecturer Assignments", "description": "Teaching assignments per offering"},
        {"name": "Enrollments", "description": "Student enrollment in offerings"},
        {"name": "Curriculum", "description": "Programme curriculum course mapping"},
        {"name": "Resources", "description": "Academic materials and upload lifecycle"},
        {"name": "Resource Versions", "description": "Immutable version history per resource"},
        {"name": "Summaries", "description": "Asynchronous AI summarization jobs"},
        {"name": "Concepts", "description": "Knowledge-graph concept nodes"},
        {"name": "Concept Relationships", "description": "Typed edges between concepts"},
        {"name": "Chat", "description": "Grounded AI assistant sessions and messages"},
        {"name": "Quizzes", "description": "Quiz CRUD and AI generation"},
        {"name": "Quiz Questions", "description": "Questions belonging to quizzes"},
        {"name": "Quiz Attempts", "description": "Student attempts and server-side scoring"},
        {"name": "Notes", "description": "Personal notes"},
        {"name": "Bookmarks", "description": "Saved resources"},
        {"name": "Progress", "description": "Per-concept learning progress"},
        {"name": "Administration", "description": "Audit logs and operational data (admins)"},
        {"name": "Platform", "description": "Platform-wide management for superusers (tenants, analytics, health, announcements)"},
        {"name": "System", "description": "Health and background-job status"},
    ],
    "ENUM_NAME_OVERRIDES": {
        "UserRoleEnum": "apps.accounts.models.User.Role",
        "ResourceVisibilityEnum": "apps.resources.models.Resource.Visibility",
        "ResourceProcessingStatusEnum": "apps.resources.models.Resource.ProcessingStatus",
    },
}

# Redis / Celery
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "amqp://academiai:academiai@localhost:5672//")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
# When CELERY_TASK_ALWAYS_EAGER=True (set in .env for dev / Windows solo),
# tasks run synchronously inside the web process on .delay()/.apply_async().
# CELERY_TASK_STORE_EAGER_RESULT ensures AsyncResult(task_id) can read the
# result back; without this, eager tasks look broken / NotRegistered.
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "False").lower() in ("1", "true", "yes")
_default_eager_propagates = "True" if CELERY_TASK_ALWAYS_EAGER else "False"
CELERY_TASK_EAGER_PROPAGATES = os.getenv("CELERY_TASK_EAGER_PROPAGATES", _default_eager_propagates).lower() in ("1", "true", "yes")
CELERY_TASK_STORE_EAGER_RESULT = CELERY_TASK_ALWAYS_EAGER
CELERY_TASK_ROUTES = {
    "apps.resources.tasks.*": {"queue": "ingestion"},
    "apps.resources.summary_tasks.*": {"queue": "ai"},
    "apps.knowledge.tasks.*": {"queue": "ingestion"},
    "apps.chat.tasks.*": {"queue": "ai"},
    "apps.assessments.tasks.*": {"queue": "ai"},
    "apps.accounts.tasks.send_tenant_suspension_emails": {"queue": "email"},
    "apps.platform.tasks.*": {"queue": "email"},
    "apps.accounts.tasks.restrict_suspended_tenant_logins": {"queue": "celery"},
}

# Tenant suspension grace period — users can still log in for this long
# after suspension; the scheduled task then deactivates their accounts.
SUSPENSION_GRACE_HOURS = int(os.getenv("SUSPENSION_GRACE_HOURS", "24"))

CELERY_BEAT_SCHEDULE = {
    "restrict-suspended-tenant-logins": {
        # Enforces the 24h post-suspension login restriction.
        "task": "apps.accounts.tasks.restrict_suspended_tenant_logins",
        "schedule": 60 * 30,  # every 30 minutes
    },
}

# Object storage
STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "minio")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "minioadmin")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin")
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "academiai-resources")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "http://localhost:9000")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
AWS_DEFAULT_ACL = "private"
AWS_QUERYSTRING_AUTH = True
AWS_S3_SIGNATURE_VERSION = "s3v4"
AWS_S3_FILE_OVERWRITE = False

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "text-embedding-004")
EMBEDDING_DIMENSION = int(os.getenv("EMBEDDING_DIMENSION", "768"))

# Auth tokens / codes
AUTH_VERIFICATION_CODE_EXPIRY_MINUTES = int(os.getenv("AUTH_VERIFICATION_CODE_EXPIRY_MINUTES", "15"))
AUTH_PASSWORD_RESET_EXPIRY_MINUTES = int(os.getenv("AUTH_PASSWORD_RESET_EXPIRY_MINUTES", "30"))
AUTH_MAX_VERIFICATION_ATTEMPTS = int(os.getenv("AUTH_MAX_VERIFICATION_ATTEMPTS", "5"))

# Email
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "AcademiAI <noreply@academiai.local>")
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True").lower() in ("1", "true", "yes")

# Debug Toolbar (dev only)
INTERNAL_IPS = ["127.0.0.1", "localhost"]
DEBUG_TOOLBAR_CONFIG = {"SHOW_TOOLBAR_CALLBACK": lambda request: DEBUG}

# --- Production security hardening (env-driven; no-ops under DEBUG) -------
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "True").lower() in ("1", "true", "yes")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_HTTPONLY = True
    CSRF_COOKIE_HTTPONLY = True
    X_FRAME_OPTIONS = "DENY"

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {name} {message}",
            "style": "{",
        },
        "structured": {
            "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
        "celery": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}
