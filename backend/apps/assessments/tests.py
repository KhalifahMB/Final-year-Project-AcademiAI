import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.academics.models import (
	AcademicSession, Course, CourseOffering, Department, Faculty, Semester,
)
from apps.assessments.models import Quiz, QuizAttempt
from apps.tenants.models import Tenant


@pytest.mark.django_db
def test_unenrolled_student_cannot_start_offering_quiz():
	tenant = Tenant.objects.create(name="Assessment Uni", slug="assessment-uni")
	user = User.objects.create_user(
		email="student@assessment-uni.edu", password="StrongPass!2026",
		tenant=tenant, role="student", is_email_verified=True,
	)
	faculty = Faculty.objects.create(tenant=tenant, name="Science", code="SCI")
	department = Department.objects.create(
		tenant=tenant, faculty=faculty, name="Computing", code="COMP",
	)
	course = Course.objects.create(
		tenant=tenant, department=department, code="CS201", title="Algorithms",
	)
	session = AcademicSession.objects.create(
		tenant=tenant, name="2026/2027", start_date="2026-09-01", end_date="2027-07-31",
	)
	semester = Semester.objects.create(
		tenant=tenant, academic_session=session, name="First",
		start_date="2026-09-01", end_date="2027-01-31",
	)
	offering = CourseOffering.objects.create(
		tenant=tenant, course=course, academic_session=session, semester=semester,
	)
	quiz = Quiz.objects.create(
		tenant=tenant, course_offering=offering, created_by=user,
		title="Algorithms quiz", status=Quiz.Status.PUBLISHED,
	)
	client = APIClient()
	client.force_authenticate(user=user)

	response = client.post(
		"/api/v1/quiz-attempts/", {"quiz": str(quiz.id)}, format="json",
	)

	assert response.status_code == 403, response.data
	assert not QuizAttempt.objects.filter(quiz=quiz, student=user).exists()
