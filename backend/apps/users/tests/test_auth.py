import pytest
from django.urls import reverse
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_register_and_verify_and_login_flow(client: APIClient):
	# register
	resp = client.post("/api/auth/register", {"email": "u@example.com", "password": "StrongPass123", "display_name": "User"}, format="json")
	assert resp.status_code == 201

	# try login before verify should fail
	resp = client.post("/api/auth/login", {"email": "u@example.com", "password": "StrongPass123"}, format="json")
	assert resp.status_code == 400

	# fetch token by generating directly via endpoint isn't possible; skip email step and set user verified
	from django.contrib.auth import get_user_model

	User = get_user_model()
	user = User.objects.get(email="u@example.com")
	user.is_active = True
	user.is_email_verified = True
	user.save()

	resp = client.post("/api/auth/login", {"email": "u@example.com", "password": "StrongPass123"}, format="json")
	assert resp.status_code == 200
	access = resp.json()["access"]

	resp = client.get("/api/secure/ping", HTTP_AUTHORIZATION=f"Bearer {access}")
	assert resp.status_code == 200
	assert resp.json()["ok"] is True
