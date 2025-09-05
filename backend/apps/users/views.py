from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.shortcuts import redirect
from django.urls import reverse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .serializers import (
	LoginSerializer,
	RegisterSerializer,
	RequestPasswordResetSerializer,
	ResetPasswordSerializer,
	UserSerializer,
)
from .tokens import generate_token, verify_token, now_ts

User = get_user_model()


class RegisterView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = RegisterSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		user = serializer.save()

		# send verification email with token
		token = generate_token({"uid": user.id, "ts": now_ts()}, salt="email-verify")
		verify_link = f"{request.build_absolute_uri(reverse('admin:index'))}"  # placeholder base
		verify_link = request.build_absolute_uri("/api/auth/verify-email") + f"?token={token}"
		send_mail(
			"Verify your RankCatalyst account",
			f"Click to verify: {verify_link}",
			"no-reply@rankcatalyst.local",
			[user.email],
		)
		return Response({"detail": "Registered. Check email to verify."}, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
	permission_classes = [permissions.AllowAny]

	def get(self, request):
		token = request.query_params.get("token")
		data = verify_token(token or "", salt="email-verify")
		if not data:
			return Response({"detail": "Invalid or expired token"}, status=status.HTTP_400_BAD_REQUEST)
		try:
			user = User.objects.get(id=data.get("uid"))
		except User.DoesNotExist:
			return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
		user.is_active = True
		user.is_email_verified = True
		user.save(update_fields=["is_active", "is_email_verified"])
		return Response({"detail": "Email verified"})


class LoginView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = LoginSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		user = serializer.validated_data["user"]
		refresh = RefreshToken.for_user(user)
		access = str(refresh.access_token)
		return Response(
			{"access": str(access), "refresh": str(refresh), "user": UserSerializer(user).data}
		)


class RefreshTokenView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		refresh_token = request.data.get("refresh")
		if not refresh_token:
			return Response({"detail": "Missing refresh token"}, status=400)
		try:
			refresh = RefreshToken(refresh_token)
			access = str(refresh.access_token)
			return Response({"access": access})
		except Exception:
			return Response({"detail": "Invalid refresh token"}, status=401)


class LogoutView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		# Blacklist refresh if desired; SimpleJWT requires enabling blacklist app.
		# For simplicity, we accept and do nothing server-side; clients should delete tokens.
		return Response({"detail": "Logged out"})


class MeView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		return Response(UserSerializer(request.user).data)


class RequestPasswordResetView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = RequestPasswordResetSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		email = serializer.validated_data["email"].lower()
		try:
			user = User.objects.get(email=email)
		except User.DoesNotExist:
			# do not reveal existence
			return Response({"detail": "If the email exists, a link was sent."})
		token = generate_token({"uid": user.id, "ts": now_ts()}, salt="password-reset")
		reset_link = request.build_absolute_uri("/api/auth/reset-password") + f"?token={token}"
		send_mail(
			"Reset your RankCatalyst password",
			f"Click to reset: {reset_link}",
			"no-reply@rankcatalyst.local",
			[user.email],
		)
		return Response({"detail": "If the email exists, a link was sent."})


class ResetPasswordView(APIView):
	permission_classes = [permissions.AllowAny]

	def post(self, request):
		serializer = ResetPasswordSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		data = verify_token(serializer.validated_data["token"], salt="password-reset")
		if not data:
			return Response({"detail": "Invalid or expired token"}, status=400)
		try:
			user = User.objects.get(id=data.get("uid"))
		except User.DoesNotExist:
			return Response({"detail": "User not found"}, status=404)
		user.set_password(serializer.validated_data["new_password"])
		user.save(update_fields=["password"])
		return Response({"detail": "Password reset successful"})
