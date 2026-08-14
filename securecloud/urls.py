"""
urls.py (root)
===============
Menghubungkan dua jenis route:
1. Route HALAMAN (mengembalikan template HTML yang sudah Anda buat:
   login.html, register.html, dashboard.html, totp-setup.html, totp-verify.html)
2. Route API (di bawah prefix /api/) yang dipanggil oleh login.js,
   register.js, totp.js, dan dashboard.js melalui fetch().
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from securecloud import views as page_views

urlpatterns = [
    path('admin/', admin.site.urls),

    # ---------- Halaman (render template) ----------
    path('', page_views.login_page, name='home'),
    path('login/', page_views.login_page, name='login-page'),
    path('register/', page_views.register_page, name='register-page'),
    path('totp-setup/', page_views.totp_setup_page, name='totp-setup-page'),
    path('totp-verify/', page_views.totp_verify_page, name='totp-verify-page'),
    path('dashboard/', page_views.dashboard_page, name='dashboard-page'),

    # ---------- API ----------
    # Semua endpoint file (upload/list/download/rename/delete/edit) dipanggil
    # frontend di bawah /api/accounts/files/..., karena itu di-nest di dalam
    # accounts.urls, bukan didaftarkan terpisah.
    path('api/accounts/', include('accounts.urls')),
]

# Selama development, biarkan Django yang melayani file di MEDIA_ROOT
# (walaupun pada praktiknya file diambil lewat view download di vault,
# bukan akses langsung ke media/, demi kontrol autentikasi & ciphertext).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
