"""
accounts/decorators.py
========================
Django menyediakan @login_required bawaan, tapi decorator itu me-redirect
ke halaman login (HTTP 302) saat belum login - cocok untuk halaman HTML,
TAPI tidak cocok untuk endpoint API yang dipanggil lewat fetch() dan
mengharapkan JSON. Decorator kecil ini dipakai di endpoint API (accounts
& vault) supaya frontend (dashboard.js) mendapat status 401 + JSON yang
jelas saat sesi belum/tidak valid.
"""
from functools import wraps

from django.http import JsonResponse


def api_login_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse(
                {'success': False, 'message': 'Sesi tidak ditemukan, silakan login kembali'},
                status=401,
            )
        return view_func(request, *args, **kwargs)
    return wrapper
