"""
Full authentication flow: signup → verify → login → me → password change.
Uses the services layer directly to obtain the verification code (only its
hash is persisted; plaintext is never stored or logged).
"""
import pytest
from django.core import mail
from rest_framework.test import APIClient

from apps.accounts import services
from apps.accounts.models import User
from apps.tenants.models import Tenant

PASSWORD = "StrongPass!2026x"


@pytest.mark.django_db
def test_signup_verify_login_me_flow():
    tenant = Tenant.objects.create(name="Flow Univ", slug="flow-u")
    client = APIClient()

    # Signup (email queued asynchronously; console/locmem backend in tests)
    resp = client.post(
        "/api/v1/auth/signup/",
        {
            "email": "flow@flow-u.edu",
            "password": PASSWORD,
            "first_name": "Flo",
            "last_name": "Wers",
            "role": "student",
            "tenant_slug": "flow-u",
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data
    user = User.objects.get(email="flow@flow-u.edu")
    assert not user.is_email_verified

    # Login must be refused before verification.
    resp = client.post(
        "/api/v1/auth/login/",
        {"email": "flow@flow-u.edu", "password": PASSWORD},
        format="json",
    )
    assert resp.status_code == 403

    # Obtain a fresh code via service (plaintext only returned here).
    code = services.create_verification_code(user)
    resp = client.post(
        "/api/v1/auth/verify-email/",
        {"email": "flow@flow-u.edu", "code": code},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    user.refresh_from_db()
    assert user.is_email_verified

    # Code is single-use: replay fails.
    resp = client.post(
        "/api/v1/auth/verify-email/",
        {"email": "flow@flow-u.edu", "code": code},
        format="json",
    )
    assert resp.status_code == 400

    # Wrong code rejected.
    resp = client.post(
        "/api/v1/auth/verify-email/",
        {"email": "flow@flow-u.edu", "code": "000000"},
        format="json",
    )
    assert resp.status_code == 400

    # Login now succeeds and returns tokens.
    resp = client.post(
        "/api/v1/auth/login/",
        {"email": "flow@flow-u.edu", "password": PASSWORD},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    access = resp.data["access"]
    refresh = resp.data["refresh"]

    # /auth/me works with the access token.
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    resp = client.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    assert resp.data["email"] == "flow@flow-u.edu"
    assert resp.data["role"] == "student"

    # Password change requires current password.
    resp = client.post(
        "/api/v1/auth/password-change/",
        {"old_password": "wrong", "new_password": "AnotherPass!2026"},
        format="json",
    )
    assert resp.status_code == 400
    resp = client.post(
        "/api/v1/auth/password-change/",
        {"old_password": PASSWORD, "new_password": "AnotherPass!2026"},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_password_reset_flow_single_use_and_generic_responses():
    tenant = Tenant.objects.create(name="Reset Univ", slug="reset-u")
    User.objects.create_user(
        email="reset@reset-u.edu",
        password=PASSWORD,
        tenant=tenant,
        role="admin",
        is_email_verified=True,
    )
    anon = APIClient()

    # Generic response whether or not the account exists (no enumeration).
    resp_known = anon.post(
        "/api/v1/auth/password-reset/request/",
        {"email": "reset@reset-u.edu"},
        format="json",
    )
    resp_unknown = anon.post(
        "/api/v1/auth/password-reset/request/",
        {"email": "ghost@nowhere.io"},
        format="json",
    )
    assert resp_known.status_code == resp_unknown.status_code == 200
    assert resp_known.data["message"] == resp_unknown.data["message"]

    user = User.objects.get(email="reset@reset-u.edu")
    token = services.create_password_reset_token(user)

    resp = anon.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "email": "reset@reset-u.edu",
            "token": token,
            "new_password": "BrandNew!2026pw",
        },
        format="json",
    )
    assert resp.status_code == 200

    # Token reuse denied.
    resp = anon.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "email": "reset@reset-u.edu",
            "token": token,
            "new_password": "AgainNew!2026pw",
        },
        format="json",
    )
    assert resp.status_code == 400

    # Old password no longer valid; new one works.
    resp = anon.post(
        "/api/v1/auth/login/",
        {"email": "reset@reset-u.edu", "password": PASSWORD},
        format="json",
    )
    assert resp.status_code == 401
    resp = anon.post(
        "/api/v1/auth/login/",
        {"email": "reset@reset-u.edu", "password": "BrandNew!2026pw"},
        format="json",
    )
    assert resp.status_code == 200
