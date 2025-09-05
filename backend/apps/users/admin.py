from django.contrib import admin

from .models import Profile, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
	list_display = ("email", "is_active", "is_staff", "is_email_verified", "date_joined")
	search_fields = ("email",)
	list_filter = ("is_active", "is_staff", "is_email_verified")
	ordering = ("-date_joined",)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
	list_display = ("user", "display_name", "role", "created_at")
	search_fields = ("user__email", "display_name")
	list_filter = ("role",)
