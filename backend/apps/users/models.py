from __future__ import annotations

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
	use_in_migrations = True

	def _create_user(self, email: str, password: str | None, **extra_fields):
		if not email:
			raise ValueError("The Email must be set")
		email = self.normalize_email(email)
		user = self.model(email=email, **extra_fields)
		user.set_password(password)
		user.save(using=self._db)
		return user

	def create_user(self, email: str, password: str | None = None, **extra_fields):
		extra_fields.setdefault("is_staff", False)
		extra_fields.setdefault("is_superuser", False)
		return self._create_user(email, password, **extra_fields)

	def create_superuser(self, email: str, password: str, **extra_fields):
		extra_fields.setdefault("is_staff", True)
		extra_fields.setdefault("is_superuser", True)
		extra_fields.setdefault("is_active", True)

		if extra_fields.get("is_staff") is not True:
			raise ValueError("Superuser must have is_staff=True.")
		if extra_fields.get("is_superuser") is not True:
			raise ValueError("Superuser must have is_superuser=True.")
		return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
	email = models.EmailField(unique=True)
	is_active = models.BooleanField(default=False)
	is_staff = models.BooleanField(default=False)
	is_email_verified = models.BooleanField(default=False)
	date_joined = models.DateTimeField(default=timezone.now)

	objects = UserManager()

	USERNAME_FIELD = "email"
	REQUIRED_FIELDS: list[str] = []

	def __str__(self) -> str:
		return self.email


class Profile(models.Model):
	ROLE_CHOICES = (
		("student", "Student"),
		("admin", "Admin"),
	)
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
	display_name = models.CharField(max_length=150, blank=True)
	avatar_url = models.URLField(blank=True)
	role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:
		return f"Profile({self.user.email})"
