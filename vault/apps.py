from django.apps import AppConfig


class VaultConfig(AppConfig):
    """
    App 'vault' menangani penyimpanan file HASIL ENKRIPSI (ciphertext).

    Sesuai arsitektur penelitian:
    - App ini TIDAK melakukan enkripsi maupun dekripsi.
    - App ini hanya menerima ciphertext dari frontend, menyimpannya ke
      folder storage, dan mencatat metadata-nya ke MySQL.
    - Saat download, app ini hanya mengirim kembali ciphertext apa adanya;
      proses dekripsi dilakukan oleh browser (chacha20poly1305.js).
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'vault'
