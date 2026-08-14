from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """
    App 'accounts' menangani:
    - Registrasi pengguna
    - Login (username/email + password)
    - Autentikasi dua faktor (TOTP) - setup & verifikasi

    Ini adalah implementasi langsung dari Bab 3 subbab
    "Two-Factor Authentication (2FA)" dan "Time-Based One-Time Password (TOTP)".
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
