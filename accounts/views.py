"""
accounts/views.py - Versi Supabase Client (REST API)
"""

import json
import base64
import io
import os
from datetime import datetime

import pyotp
import qrcode
from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth.hashers import make_password, check_password
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from supabase import create_client

from .decorators import api_login_required

# 🔥 BUAT SUPABASE CLIENT LANGSUNG DI SINI
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _parse_json(request):
    try:
        return json.loads(request.body.decode('utf-8')), None
    except:
        return None, JsonResponse({'success': False, 'message': 'Format request tidak valid'}, status=400)


def _generate_qr_code_data_uri(email, secret):
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name='SecureCloud')
    img = qrcode.make(uri)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    encoded = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f'data:image/png;base64,{encoded}'


@csrf_exempt
@require_http_methods(['POST'])
def register_view(request):
    payload, err = _parse_json(request)
    if err:
        return err

    username = (payload.get('username') or '').strip()
    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''
    password_confirm = payload.get('password_confirm') or ''

    errors = {}
    if len(username) < 3:
        errors['username'] = 'Username minimal 3 karakter'
    
    if not email or '@' not in email:
        errors['email'] = 'Email tidak valid'
    
    if len(password) < 8:
        errors['password'] = 'Password minimal 8 karakter'
    elif password != password_confirm:
        errors['password2'] = 'Konfirmasi password tidak cocok'

    if errors:
        return JsonResponse({'success': False, 'message': 'Registrasi gagal', 'errors': errors}, status=400)

    # Cek user existing via Supabase
    existing = supabase.table('users').select('*').eq('email', email).execute()
    if existing.data:
        return JsonResponse({'success': False, 'message': 'Email sudah terdaftar'}, status=400)
    
    existing_username = supabase.table('users').select('*').eq('username', username).execute()
    if existing_username.data:
        return JsonResponse({'success': False, 'message': 'Username sudah digunakan'}, status=400)

    # Buat user di Supabase
    totp_secret = pyotp.random_base32()
    hashed_password = make_password(password)

    user_data = {
        'username': username,
        'email': email,
        'password': hashed_password,
        'totp_secret': totp_secret,
        'totp_enabled': False,
        'date_joined': datetime.now().isoformat(),
        'is_active': True
    }

    result = supabase.table('users').insert(user_data).execute()
    
    if not result.data:
        return JsonResponse({'success': False, 'message': 'Gagal registrasi'}, status=500)

    qr_code_data_uri = _generate_qr_code_data_uri(email, totp_secret)

    return JsonResponse({
        'success': True,
        'message': 'Registrasi berhasil. Silakan aktifkan 2FA.',
        'data': {
            'username': username,
            'email': email,
            'totp_secret': totp_secret,
            'qr_code': qr_code_data_uri,
        },
    })


@csrf_exempt
@require_http_methods(['POST'])
def verify_totp_setup_view(request):
    payload, err = _parse_json(request)
    if err:
        return err

    email = (payload.get('email') or '').strip().lower()
    token = (payload.get('totp_code') or '').strip()

    # Cari user di Supabase
    result = supabase.table('users').select('*').eq('email', email).execute()
    
    if not result.data:
        return JsonResponse({'success': False, 'message': 'Akun tidak ditemukan'}, status=404)
    
    user = result.data[0]

    if user.get('totp_enabled', False):
        return JsonResponse({'success': False, 'message': '2FA sudah aktif'}, status=400)

    totp = pyotp.TOTP(user['totp_secret'])
    if not totp.verify(token, valid_window=1):
        return JsonResponse({'success': False, 'message': 'Kode TOTP tidak valid'}, status=400)

    # Update user di Supabase
    supabase.table('users').update({'totp_enabled': True}).eq('id', user['id']).execute()

    # 🔥 CARI ATAU BUAT DJANGO USER
    from django.contrib.auth import login as django_login
    from django.contrib.auth.models import User
    from django.contrib.auth.backends import ModelBackend
    
    try:
        django_user = User.objects.get(username=user['username'])
    except User.DoesNotExist:
        django_user = User.objects.create_user(
            username=user['username'],
            email=user['email'],
            password='temporary_password_123'
        )
    
    # 🔥 PASTIKAN USER AKTIF
    django_user.is_active = True
    django_user.save()
    
    # 🔥 SET BACKEND (INI YANG PALING PENTING!)
    django_user.backend = 'django.contrib.auth.backends.ModelBackend'
    
    # 🔥 LOGIN
    django_login(request, django_user)
    
    if request.user.is_authenticated:
        return JsonResponse({
            'success': True,
            'message': '2FA berhasil diaktifkan',
            'data': {'username': user['username'], 'email': user['email']},
        })
    else:
        return JsonResponse({'success': False, 'message': 'Gagal membuat session'}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def login_view(request):
    payload, err = _parse_json(request)
    if err:
        return err

    email = (payload.get('email') or '').strip().lower()
    password = payload.get('password') or ''
    totp_code = (payload.get('totp_code') or '').strip()

    # Cari user di Supabase
    result = supabase.table('users').select('*').eq('email', email).execute()
    
    if not result.data:
        return JsonResponse({'success': False, 'message': 'Email atau password salah'}, status=400)
    
    user = result.data[0]

    # Verifikasi password (hash Django)
    if not check_password(password, user['password']):
        return JsonResponse({'success': False, 'message': 'Email atau password salah'}, status=400)

    if not user.get('totp_enabled', False):
        return JsonResponse({'success': False, 'message': 'Akun belum aktivasi 2FA'}, status=400)

    # Tahap 1: minta TOTP
    if not totp_code:
        return JsonResponse({'success': True, 'require_totp': True, 'email': user['email']})

    # Tahap 2: verifikasi TOTP
    totp = pyotp.TOTP(user['totp_secret'])
    if not totp.verify(totp_code, valid_window=1):
        return JsonResponse({'success': False, 'message': 'Kode TOTP tidak valid'}, status=400)

    # 🔥 CARI ATAU BUAT DJANGO USER DI SQLITE
    from django.contrib.auth import login as django_login
    from django.contrib.auth.models import User
    from django.contrib.auth.backends import ModelBackend
    
    try:
        django_user = User.objects.get(username=user['username'])
        print(f"✅ User ditemukan di SQLite: {django_user.username}")
    except User.DoesNotExist:
        print(f"⚠️ User {user['username']} tidak ditemukan di SQLite, membuat baru...")
        django_user = User.objects.create_user(
            username=user['username'],
            email=user['email'],
            password=user['password']  # 🔥 PAKAI PASSWORD DARI SUPABASE!
        )
        django_user.is_active = True
        django_user.save()
        print(f"✅ User {django_user.username} berhasil dibuat di SQLite!")
    
    # 🔥 SET BACKEND
    django_user.backend = 'django.contrib.auth.backends.ModelBackend'
    
    # 🔥 LOGIN
    django_login(request, django_user)
    
    # 🔥 CEK SESSION
    print(f"🔍 Session setelah login: {request.session.keys()}")
    print(f"🔍 User terautentikasi: {request.user.is_authenticated}")
    
    if request.user.is_authenticated:
        return JsonResponse({
            'success': True,
            'message': 'Login berhasil',
            'data': {'username': user['username'], 'email': user['email']},
        })
    else:
        return JsonResponse({'success': False, 'message': 'Gagal membuat session'}, status=500)


@require_http_methods(['GET'])
def csrf_token_view(request):
    from django.middleware.csrf import get_token
    return JsonResponse({'csrf_token': get_token(request)})


@api_login_required
@require_http_methods(['GET'])
def current_user_view(request):
    return JsonResponse({
        'success': True,
        'username': request.user.username,
        'email': request.user.email,
    })


@csrf_exempt
@api_login_required
@require_http_methods(['GET', 'POST'])  # ← UBAH JADI GET & POST
def logout_view(request):
    """Logout - hapus session Django dan cookie (support GET & POST)"""
    from django.contrib.auth import logout as django_logout
    
    # Hapus session
    django_logout(request)
    
    # Hapus session cookie di browser
    response = JsonResponse({'success': True, 'message': 'Logout berhasil'})
    response.delete_cookie('sessionid')
    
    return response

