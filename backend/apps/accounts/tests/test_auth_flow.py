"""
Full authentication flow: signup → verify → login → me → password change.
Uses the services layer directly to obtain the verification code (only its
hash is persisted; plaintext is never stored or logged).
"""
import re

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

    # HttpOnly JWT cookies are set for the SPA: SameSite=Strict, path-scoped
    # to the API, and not readable from JS.
    cookie = resp.cookies.get("access_token")
    assert cookie is not None
    assert cookie["httponly"] is True
    assert cookie["samesite"].lower() == "strict"
    assert cookie["path"] == "/api/v1"
    assert resp.cookies.get("refresh_token") is not None

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
        role="tenant_admin",
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
    code = services.create_password_reset_code(user)
    assert re.fullmatch(r"\d{6}", code)

    resp = anon.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "email": "reset@reset-u.edu",
            "token": code,
            "new_password": "BrandNew!2026pw",
        },
        format="json",
    )
    assert resp.status_code == 200

    # Code reuse denied.
    resp = anon.post(
        "/api/v1/auth/password-reset/confirm/",
        {
            "email": "reset@reset-u.edu",
            "token": code,
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


@pytest.mark.django_db
def test_password_reset_rejects_anything_that_is_not_6_digits():
    tenant = Tenant.objects.create(name="Six Univ", slug="six-u")
    User.objects.create_user(
        email="six@six-u.edu",
        password=PASSWORD,
        tenant=tenant,
        role="tenant_admin",
        is_email_verified=True,
    )
    anon = APIClient()

    for bad in ("12345", "1234567", "abcdef"):
        resp = anon.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "email": "six@six-u.edu",
                "token": bad,
                "new_password": "BrandNew!2026pw",
            },
            format="json",
        )
        assert resp.status_code == 400, bad
        assert "6-digit" in str(resp.data["error"]["detail"])


@pytest.mark.django_db
def test_password_reset_code_is_6_digits_and_guesses_are_capped():
    """A 6-digit space is only safe if a wrong guess burns an attempt."""
    from django.conf import settings as dj_settings

    tenant = Tenant.objects.create(name="Cap Univ", slug="cap-u")
    user = User.objects.create_user(
        email="cap@cap-u.edu",
        password=PASSWORD,
        tenant=tenant,
        role="tenant_admin",
        is_email_verified=True,
    )
    code = services.create_password_reset_code(user)
    assert re.fullmatch(r"\d{6}", code)

    wrong = "000000" if code != "000000" else "000001"
    for _ in range(dj_settings.AUTH_MAX_RESET_ATTEMPTS):
        with pytest.raises(ValueError, match="Invalid or expired reset code"):
            services.confirm_password_reset(user.email, wrong, "BrandNew!2026pw")

    # Once exhausted, even the right code is refused.
    with pytest.raises(ValueError, match="Too many attempts"):
        services.confirm_password_reset(user.email, code, "BrandNew!2026pw")

    # Requesting a fresh code resets the counter and the reset goes through.
    fresh = services.create_password_reset_code(user)
    services.confirm_password_reset(user.email, fresh, "BrandNew!2026pw")
    user.refresh_from_db()
    assert user.check_password("BrandNew!2026pw")


@pytest.mark.django_db
def test_signup_cannot_attach_cross_tenant_programme():
    """A student must never be attached to another tenant's programme, even
    if they forge that programme's id at signup. This assertion must hold
    regardless of whether database RLS is enabled."""
    from apps.accounts.models import StudentProfile

    tenant_a = Tenant.objects.create(name="New Univ", slug="new-u")
    tenant_b = Tenant.objects.create(name="Other Univ", slug="other-u")

    # Build academic structure for tenant B (the "other" institution).
    from apps.academics.models import Department, Faculty, Programme

    fac_b = Faculty.objects.create(tenant=tenant_b, name="Science", code="SCI")
    dept_b = Department.objects.create(tenant=tenant_b, faculty=fac_b, name="CS", code="CS")
    prog_b = Programme.objects.create(
        tenant=tenant_b, department=dept_b, name="BSc CS", code="BSC-CS"
    )

    client = APIClient()
    resp = client.post(
        "/api/v1/auth/signup/",
        {
            "email": "stu@new-u.edu",
            "password": PASSWORD,
            "role": "student",
            "tenant_slug": "new-u",
            # Forge tenant B's programme id while signing up for tenant A.
            "programme": str(prog_b.id),
        },
        format="json",
    )
    assert resp.status_code == 201, resp.data

    user = User.objects.get(email="stu@new-u.edu")
    profile = StudentProfile.objects.get(user=user)
    # The cross-tenant programme MUST NOT be attached (IDOR-safe), regardless
    # of whether RLS is actually enforced on the database.
    assert profile.programme_id is None
    assert profile.tenant_id == tenant_a.id

    # Verify → no enrollments must be created in either tenant: enrolment is
    # opt-in (student self-enrolment or admin management) and the forged
    # programme must never leak coursework access across institutions.
    from apps.academics.models import CourseEnrollment

    code = services.create_verification_code(user)
    resp = client.post(
        "/api/v1/auth/verify-email/",
        {"email": "stu@new-u.edu", "code": code},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    assert CourseEnrollment.objects.filter(tenant_id=tenant_a.id).count() == 0
    assert CourseEnrollment.objects.filter(tenant_id=tenant_b.id).count() == 0
