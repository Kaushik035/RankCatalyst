from django.contrib import admin
from django.urls import include, path
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated


@api_view(["GET"])  # /api/secure/ping
@permission_classes([IsAuthenticated])
def secure_ping(request):
	return Response({"ok": True})


urlpatterns = [
	path("admin/", admin.site.urls),
	path("api/secure/ping", secure_ping),
	path("api/auth/", include("apps.users.urls")),
]
