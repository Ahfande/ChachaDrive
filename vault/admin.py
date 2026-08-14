from django.contrib import admin
# from django.contrib.auth.admin import UserAdmin
# from django.contrib.auth import get_user_model

# User = get_user_model()


# class CustomUserAdmin(UserAdmin):
#     """
#     Admin untuk Custom User model dengan field TOTP
#     """
#     list_display = ('username', 'email', 'totp_enabled', 'is_staff', 'is_active', 'date_joined')
#     list_filter = ('totp_enabled', 'is_staff', 'is_active')
#     search_fields = ('username', 'email')
    
#     fieldsets = UserAdmin.fieldsets + (
#         ('TOTP Settings', {
#             'fields': ('totp_secret', 'totp_enabled'),
#         }),
#     )
#     add_fieldsets = UserAdmin.add_fieldsets + (
#         ('TOTP Settings', {
#             'fields': ('totp_secret', 'totp_enabled'),
#         }),
#     )


# # Unregister default User admin, register custom one
# admin.site.unregister(User)
# admin.site.register(User, CustomUserAdmin)