"""
API tests for authentication (run with DB available).
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_signup_validation():
    client = APIClient()
    resp = client.post("/api/v1/auth/signup/", {}, format="json")
    assert resp.status_code in (400, 401)


@pytest.mark.django_db
def test_login_invalid_credentials():
    client = APIClient()
    resp = client.post(
        "/api/v1/auth/login/",
        {"email": "nobody@example.com", "password": "wrong"},
        format="json",
    )
    assert resp.status_code == 401
