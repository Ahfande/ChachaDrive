from django.urls import include, path

from . import views

urlpatterns = [
    path('register/', views.register_view, name='api-register'),
    path('login/', views.login_view, name='api-login'),
    path('verify-totp/', views.verify_totp_setup_view, name='api-verify-totp'),
    path('logout/', views.logout_view, name='api-logout'),
    path('csrf-token/', views.csrf_token_view, name='api-csrf-token'),
    path('current-user/', views.current_user_view, name='api-current-user'),

    # dashboard.js memanggil endpoint file di /api/accounts/files/...,
    # jadi didaftarkan (nested) di sini, bukan sebagai prefix /api/files/ terpisah.
    path('files/', include('vault.urls')),
]
