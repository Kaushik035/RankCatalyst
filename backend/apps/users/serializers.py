from __future__ import annotations

from django.contrib.auth import authenticate
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from .models import Profile, User


class ProfileSerializer(serializers.ModelSerializer):
	class Meta:
		model = Profile
		fields = ["display_name", "avatar_url", "role", "created_at"]
		read_only_fields = ["role", "created_at"]


class UserSerializer(serializers.ModelSerializer):
	profile = ProfileSerializer(read_only=True)

	class Meta:
		model = User
		fields = ["id", "email", "is_email_verified", "date_joined", "profile"]
		read_only_fields = ["id", "is_email_verified", "date_joined", "profile"]


class RegisterSerializer(serializers.Serializer):
	email = serializers.EmailField()
	password = serializers.CharField(write_only=True, min_length=8)
	display_name = serializers.CharField(required=False, allow_blank=True)

	def validate_email(self, value: str) -> str:
		if User.objects.filter(email__iexact=value).exists():
			raise serializers.ValidationError("Email already in use")
		return value

	def create(self, validated_data):
		email = validated_data["email"].lower()
		password = validated_data["password"]
		display_name = validated_data.get("display_name", "")
		user = User.objects.create_user(email=email, password=password, is_active=False)
		Profile.objects.create(user=user, display_name=display_name)
		return user


class LoginSerializer(serializers.Serializer):
	email = serializers.EmailField()
	password = serializers.CharField(write_only=True)

	def validate(self, attrs):
		email = attrs.get("email")
		password = attrs.get("password")
		user = authenticate(email=email, password=password)
		if not user:
			raise serializers.ValidationError({"detail": _("Invalid credentials")})
		if not user.is_active:
			raise serializers.ValidationError({"detail": _("Account inactive. Verify your email.")})
		attrs["user"] = user
		return attrs


class RequestPasswordResetSerializer(serializers.Serializer):
	email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
	token = serializers.CharField()
	new_password = serializers.CharField(min_length=8)
