# """
# vault/models.py
# =================
# EncryptedFile HANYA menyimpan METADATA. Isi file (ciphertext) disimpan
# sebagai file biner terpisah di folder settings.ENCRYPTED_STORAGE_DIR
# (media/storage/<id>.enc), sesuai arsitektur:
#     "Django menyimpan ciphertext ke storage" + "Django menyimpan metadata ke MySQL"

# Field `nonce` WAJIB disimpan di MySQL (bukan rahasia - nonce memang boleh
# publik pada ChaCha20-Poly1305) karena browser membutuhkannya lagi saat
# proses dekripsi di sisi client (Gambar 3.6 Flowchart Enkripsi-Dekripsi).
# Yang TIDAK PERNAH disimpan atau dilihat Django adalah master key
# pengguna - itu hanya ada di localStorage browser (lihat dashboard.js
# getMasterKey()).
# """
# from django.conf import settings
# from django.contrib.auth.models import User
# from django.db import models


# class EncryptedFile(models.Model):
#     # id dibuat di sisi CLIENT (dashboard.js: fungsi uuid()), bukan oleh
#     # Django, supaya frontend bisa langsung memakai id yang sama untuk
#     # menamai file ciphertext (<id>.enc) sebelum menerima respons server.
#     id = models.CharField(max_length=64, primary_key=True)

#     owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='files')

#     original_name = models.CharField(max_length=255)
#     file_ext = models.CharField(max_length=20, blank=True)
#     file_category = models.CharField(max_length=20, blank=True)  # image / document / other
#     mime_type = models.CharField(max_length=100, blank=True)
#     file_size = models.BigIntegerField(default=0)  # untuk tampilan ukuran & kuota storage

#     # base64 dari 12 byte nonce ChaCha20-Poly1305 (RFC 8439)
#     nonce = models.CharField(max_length=32)

#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)

#     class Meta:
#         ordering = ['-created_at']

#     def storage_path(self):
#         """Lokasi file ciphertext fisik di folder media/storage/."""
#         return settings.ENCRYPTED_STORAGE_DIR / f'{self.id}.enc'

#     def to_dict(self):
#         """
#         Bentuk JSON yang dikonsumsi dashboard.js (renderGrid, sort, dll).
#         `nonce` WAJIB ikut dikirim di sini, karena openPreview() dan
#         downloadFile() di dashboard.js mengambil nonce dari record hasil
#         /api/accounts/files/list/ (bukan dari header X-Nonce saat download)
#         untuk didekripsi dengan ChaCha20Poly1305.base64ToBytes(record.nonce).
#         """
#         return {
#             'id': self.id,
#             'original_name': self.original_name,
#             'file_ext': self.file_ext,
#             'file_category': self.file_category,
#             'mime_type': self.mime_type,
#             'file_size': self.file_size,
#             'nonce': self.nonce,
#             'created_at': self.created_at.isoformat(),
#         }

#     def __str__(self):
#         return f'{self.original_name} ({self.owner.username})'
