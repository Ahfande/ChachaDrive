"""
securecloud/views.py
=====================
View sederhana yang HANYA bertugas me-render template HTML statis yang
sudah Anda desain (login.html, register.html, dst). Tidak ada logic
autentikasi di sini - logic autentikasi ada di app 'accounts' (API).
"""
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required


def login_page(request):
    # Jika user sudah login, cek apakah sessionStorage-nya masih ada
    # (tapi ini tidak bisa dicek dari server, jadi redirect ke dashboard)
    if request.user.is_authenticated:
        return redirect('dashboard-page')
    return render(request, 'login.html')


def register_page(request):
    return render(request, 'register.html')


def totp_setup_page(request):
    return render(request, 'totp-setup.html')


def totp_verify_page(request):
    return render(request, 'totp-verify.html')


@login_required(login_url='login-page')
def dashboard_page(request):
    return render(request, 'dashboard.html')