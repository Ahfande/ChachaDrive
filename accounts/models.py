"""
accounts/models.py
====================
Model Profile menyimpan secret TOTP milik tiap pengguna.

Relasi ke Bab 3:
- "TOTP merupakan metode autentikasi yang menghasilkan kode verifikasi
  berdasarkan kombinasi secret key dan waktu sistem" -> secret key itulah
  yang disimpan di field `totp_secret`.
- `totp_enabled` merepresentasikan status "2FA sudah diaktifkan" pada
  Use Case Diagram (Gambar 3.3): pengguna WAJIB menyelesaikan setup TOTP
  sebelum bisa login dan mengakses dashboard.

Catatan: kita TIDAK membuat custom User model. Kita memakai User bawaan
Django (django.contrib.auth.models.User) untuk username/email/password,
lalu Profile menempel padanya (One-to-One) hanya untuk data TOTP.
Ini pilihan paling sederhana yang tetap memenuhi kebutuhan penelitian.
"""
from django.contrib.auth.models import User
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')

    # Secret key TOTP (base32), dibuat sekali saat registrasi dengan pyotp.random_base32()
    totp_secret = models.CharField(max_length=32)

    # False setelah registrasi, baru menjadi True setelah pengguna berhasil
    # memindai QR Code dan memasukkan kode TOTP pertama yang valid
    # (endpoint verify-totp pada Tahap Setup).
    totp_enabled = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        status = 'aktif' if self.totp_enabled else 'belum aktif'
        return f'Profile {self.user.username} (2FA {status})'
