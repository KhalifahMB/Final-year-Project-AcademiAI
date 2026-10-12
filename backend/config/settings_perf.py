"""
Load-test settings overlay.

Used ONLY to run a controlled concurrency measurement against a local
development server:

    python manage.py runserver 8001 --noreload --settings=config.settings_perf

It imports the real settings unchanged and raises the DRF throttle ceilings so
the measurement reflects the application's own capacity rather than the
per-user request caps. AI throttling is intentionally left realistic. Nothing
else differs from production, and this module is not used by any real
deployment.
"""
from .settings import *  # noqa: F401,F403

REST_FRAMEWORK = {  # noqa: F405
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_RATES": {
        **REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],  # noqa: F405
        "anon": "1000000/hour",
        "user": "1000000/hour",
        "auth": "1000000/minute",
        "auth_ip": "1000000/minute",
        "upload": "1000000/hour",
        "tenant_request": "1000000/hour",
        "public": "1000000/hour",
    },
}
