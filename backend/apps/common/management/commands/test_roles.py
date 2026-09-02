"""
Management command to test role-based frontend functionality.

Usage:
    python manage.py test_roles --role student
    python manage.py test_roles --role lecturer
    python manage.py test_roles --role tenant_admin
    python manage.py test_roles --role platform_admin
    python manage.py test_roles --all

Requires:
    - Backend server running on the specified base URL
    - Test user credentials in environment variables or .env:
        TEST_STUDENT_EMAIL, TEST_STUDENT_PASSWORD
        TEST_LECTURER_EMAIL, TEST_LECTURER_PASSWORD
        TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD
        TEST_SUPERUSER_EMAIL, TEST_SUPERUSER_PASSWORD
"""
import json
import os
import sys
import time
from urllib.parse import urljoin

from django.core.management.base import BaseCommand, CommandError
from django.test import Client


class Command(BaseCommand):
    help = "Run automated role-based frontend tests against the API"

    def add_arguments(self, parser):
        parser.add_argument(
            "--role",
            type=str,
            choices=["student", "lecturer", "tenant_admin", "platform_admin"],
            help="Role to test",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Test all roles sequentially",
        )
        parser.add_argument(
            "--base-url",
            type=str,
            default="http://localhost:8000",
            help="Backend base URL",
        )
        parser.add_argument(
            "--output",
            type=str,
            default="test_report.json",
            help="Output file for JSON report",
        )

    def handle(self, *args, **options):
        roles_to_test = []
        if options["all"]:
            roles_to_test = ["student", "lecturer", "tenant_admin", "platform_admin"]
        elif options["role"]:
            roles_to_test = [options["role"]]
        else:
            raise CommandError("Specify --role or --all")

        base_url = options["base_url"]
        report = {"base_url": base_url, "timestamp": time.time(), "roles": {}}

        for role in roles_to_test:
            self.stdout.write(f"\n{'='*60}")
            self.stdout.write(self.style.SUCCESS(f"  Testing role: {role}"))
            self.stdout.write(f"{'='*60}\n")

            result = self._test_role(role, base_url)
            report["roles"][role] = result

            passed = sum(1 for t in result["tests"] if t["status"] == "PASS")
            failed = sum(1 for t in result["tests"] if t["status"] == "FAIL")
            self.stdout.write(
                f"\n  Results: {passed} passed, {failed} failed out of {len(result['tests'])} tests\n"
            )

        # Write report
        output_path = options["output"]
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2)
        self.stdout.write(self.style.SUCCESS(f"\nReport saved to {output_path}"))

    def _get_credentials(self, role):
        """Get test credentials from environment variables."""
        env_map = {
            "student": ("TEST_STUDENT_EMAIL", "TEST_STUDENT_PASSWORD"),
            "lecturer": ("TEST_LECTURER_EMAIL", "TEST_LECTURER_PASSWORD"),
            "tenant_admin": ("TEST_ADMIN_EMAIL", "TEST_ADMIN_PASSWORD"),
            "platform_admin": ("TEST_SUPERUSER_EMAIL", "TEST_SUPERUSER_PASSWORD"),
        }
        email_key, pass_key = env_map[role]
        email = os.getenv(email_key, "")
        password = os.getenv(pass_key, "")
        return email, password

    def _login(self, client, base_url, email, password):
        """Authenticate and return JWT tokens."""
        resp = client.post(
            f"{base_url}/api/v1/auth/login/",
            data=json.dumps({"email": email, "password": password}),
            content_type="application/json",
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("access"), data.get("refresh")
        return None, None

    def _api_get(self, client, base_url, token, path):
        """Make an authenticated GET request."""
        resp = client.get(
            f"{base_url}/api/v1{path}",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        return resp

    def _api_post(self, client, base_url, token, path, data=None):
        """Make an authenticated POST request."""
        resp = client.post(
            f"{base_url}/api/v1{path}",
            data=json.dumps(data or {}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        return resp

    def _test_role(self, role, base_url):
        """Run all tests for a specific role."""
        result = {"role": role, "tests": [], "summary": {}}

        email, password = self._get_credentials(role)
        if not email or not password:
            result["tests"].append({
                "name": "Authentication",
                "status": "SKIP",
                "detail": f"Missing credentials: set {email} and password env vars",
            })
            return result

        client = Client()

        # Test 1: Login
        token, refresh = self._login(client, base_url, email, password)
        result["tests"].append({
            "name": "Login",
            "status": "PASS" if token else "FAIL",
            "detail": "JWT token obtained" if token else "Login failed",
        })

        if not token:
            return result

        # Test 2: User profile
        resp = self._api_get(client, base_url, token, "/auth/me/")
        result["tests"].append({
            "name": "Get user profile",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 3: Dashboard
        dashboard_paths = {
            "student": "/dashboard/student/",
            "lecturer": "/dashboard/lecturer/",
            "tenant_admin": "/dashboard/admin/",
            "platform_admin": "/dashboard/admin/",
        }
        resp = self._api_get(client, base_url, token, dashboard_paths[role])
        result["tests"].append({
            "name": "Dashboard endpoint",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 4: AI greeting
        resp = self._api_get(client, base_url, token, "/dashboard/ai-greeting/")
        result["tests"].append({
            "name": "AI greeting",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 5: AI insight
        resp = self._api_post(client, base_url, token, "/dashboard/ai-insight/", {"dashboard_type": role.replace("tenant_", "")})
        result["tests"].append({
            "name": "AI insight",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 6: Resources list
        resp = self._api_get(client, base_url, token, "/resources/")
        result["tests"].append({
            "name": "Resources list",
            "status": "PASS" if resp.status_code in (200, 403) else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 7: Chat sessions list
        resp = self._api_get(client, base_url, token, "/chat/sessions/")
        result["tests"].append({
            "name": "Chat sessions list",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 8: Plans list
        resp = self._api_get(client, base_url, token, "/plans/")
        result["tests"].append({
            "name": "Plans list",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 9: Progress list
        resp = self._api_get(client, base_url, token, "/progress/")
        result["tests"].append({
            "name": "Progress list",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 10: Notes list
        resp = self._api_get(client, base_url, token, "/notes/")
        result["tests"].append({
            "name": "Notes list",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 11: Bookmarks list
        resp = self._api_get(client, base_url, token, "/bookmarks/")
        result["tests"].append({
            "name": "Bookmarks list",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 12: Agent tools
        resp = self._api_get(client, base_url, token, "/agent/tools/")
        result["tests"].append({
            "name": "Agent tools list",
            "status": "PASS" if resp.status_code == 200 else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 13: Create a plan
        resp = self._api_post(client, base_url, token, "/plans/", {
            "title": f"Test Plan ({role})",
            "description": "Automated test plan",
            "plan_type": "study",
        })
        result["tests"].append({
            "name": "Create plan",
            "status": "PASS" if resp.status_code in (200, 201) else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Test 14: Notes list (page size)
        resp = self._api_get(client, base_url, token, "/notes/?page_size=5")
        result["tests"].append({
            "name": "Notes with pagination",
            "status": "PASS" if resp.status_code in (200, 400) else "FAIL",
            "detail": f"HTTP {resp.status_code}",
        })

        # Role-specific tests
        if role in ("tenant_admin", "platform_admin"):
            # Test logs access
            resp = self._api_get(client, base_url, token, "/logs/")
            result["tests"].append({
                "name": "Logs access (admin)",
                "status": "PASS" if resp.status_code == 200 else "FAIL",
                "detail": f"HTTP {resp.status_code}",
            })

        if role == "platform_admin":
            # Test platform endpoints
            resp = self._api_get(client, base_url, token, "/platform/tenants/")
            result["tests"].append({
                "name": "Platform tenants",
                "status": "PASS" if resp.status_code in (200, 404) else "FAIL",
                "detail": f"HTTP {resp.status_code}",
            })

        # Calculate summary
        passed = sum(1 for t in result["tests"] if t["status"] == "PASS")
        failed = sum(1 for t in result["tests"] if t["status"] == "FAIL")
        skipped = sum(1 for t in result["tests"] if t["status"] == "SKIP")
        result["summary"] = {
            "total": len(result["tests"]),
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
        }

        return result
