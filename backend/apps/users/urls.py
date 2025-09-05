from django.urls import path

from .views import (
	LoginView,
	LogoutView,
	MeView,
	RefreshTokenView,
	RegisterView,
	RequestPasswordResetView,
	ResetPasswordView,
	VerifyEmailView,
)

urlpatterns = [
	path("register", RegisterView.as_view()),
	path("login", LoginView.as_view()),
	path("refresh", RefreshTokenView.as_view()),
	path("logout", LogoutView.as_view()),
	path("request-password-reset", RequestPasswordResetView.as_view()),
	path("reset-password", ResetPasswordView.as_view()),
	path("verify-email", VerifyEmailView.as_view()),
	path("me", MeView.as_view()),
]
