# SecureCloud - Backend Django

Implementasi backend untuk penelitian skripsi:
**"Perancangan Sistem Keamanan Data pada Penyimpanan Cloud Menggunakan Enkripsi
dan Autentikasi Ganda untuk Perlindungan Data Pengguna"**

Backend ini SENGAJA dibuat sederhana. Ia HANYA bertugas: autentikasi
pengguna (username/password + TOTP) dan menyimpan/mengirim ciphertext.
Enkripsi & dekripsi ChaCha20-Poly1305 sepenuhnya dilakukan di browser
(lihat `static/js/chacha20poly1305.js`).

## 1. Instalasi

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
```

## 2. Buat database MySQL

```sql
CREATE DATABASE securecloud_db CHARACTER SET utf8mb4;
```

Jika kredensial MySQL Anda BUKAN `root` tanpa password, set environment
variable sebelum menjalankan server (atau edit langsung di
`securecloud/settings.py` bagian `DATABASES`):

```bash
set DB_NAME=securecloud_db
set DB_USER=root
set DB_PASSWORD=your_password
set DB_HOST=127.0.0.1
set DB_PORT=3306
```

## 3. Migrasi & jalankan server

```bash
python manage.py makemigrations accounts vault
python manage.py migrate
python manage.py createsuperuser   # opsional, untuk cek data lewat /admin/
python manage.py runserver 0.0.0.0:8000
```

Buka `http://localhost:8000/register/` untuk mulai mendaftar.

## 4. Struktur folder

```
securecloud/
├── securecloud/        # settings, urls, wsgi (root project)
├── accounts/           # register, login, TOTP (Bab 3: TOTP & 2FA)
├── vault/              # upload/list/download/rename/delete ciphertext
├── templates/          # login.html, dashboard.html, dst (sudah didesain)
├── static/css/js/      # termasuk chacha20poly1305.js (enkripsi client-side)
└── media/storage/      # tempat ciphertext (*.enc) disimpan
```

## 5. Peta endpoint API (dipanggil frontend)

| Method | Endpoint                              | Fungsi                                   |
|--------|----------------------------------------|-------------------------------------------|
| POST   | /api/accounts/register/               | Registrasi + generate secret & QR TOTP    |
| POST   | /api/accounts/verify-totp/            | Aktivasi 2FA (kode TOTP pertama)          |
| POST   | /api/accounts/login/                  | Login tahap 1 (email+password) & tahap 2 (+totp_code) |
| POST   | /api/accounts/logout/                 | Logout (hapus sesi Django)                |
| GET    | /api/accounts/csrf-token/              | Ambil CSRF token                          |
| GET    | /api/accounts/current-user/            | Cek sesi login masih valid                |
| POST   | /api/accounts/files/upload/           | Terima ciphertext + metadata              |
| GET    | /api/accounts/files/list/              | Daftar metadata file milik user login     |
| GET    | /api/accounts/files/download/<id>/    | Kirim ciphertext + nonce (header)         |
| PUT    | /api/accounts/files/rename/<id>/      | Ganti nama file                           |
| PUT    | /api/accounts/files/edit/<id>/        | Timpa ciphertext (edit isi file teks)     |
| DELETE | /api/accounts/files/delete/<id>/      | Hapus metadata + file fisik               |

## 6. Yang PENTING untuk sidang (Bab 4)

- Cek `vault/views.py` dan `vault/models.py` — tidak ada satupun baris kode
  yang mengenkripsi/mendekripsi. Ini bukti bahwa server hanya menyimpan
  ciphertext (sesuai Batasan Masalah).
- Master key ChaCha20-Poly1305 pengguna TIDAK PERNAH dikirim ke server -
  hanya `nonce` (boleh publik) yang disimpan di MySQL (`EncryptedFile.nonce`),
  yang dibutuhkan browser untuk dekripsi.
- 2FA (TOTP) wajib aktif sebelum akun bisa login (`Profile.totp_enabled`),
  sesuai Gambar 3.4 Activity Diagram Login dan Verifikasi TOTP.

## 7. Keterbatasan implementasi (jujur, untuk didiskusikan di sidang jika ditanya)

- Endpoint autentikasi awal (`register`, `login`, `verify-totp`) memakai
  `@csrf_exempt` karena belum ada sesi/cookie untuk mengambil CSRF token
  sebelum login. Ini konsisten dengan Batasan Masalah: penelitian ini
  berfokus pada TOTP & ChaCha20-Poly1305, bukan proteksi CSRF menyeluruh.
- `register.js` dan `totp.js` memakai `http://localhost:8000/api` (hardcoded),
  sedangkan `login.js` dan `dashboard.js` sudah dinamis mengikuti host
  halaman. Sebaiknya diseragamkan agar tidak bermasalah jika diakses lewat
  `127.0.0.1` (karena `SESSION_COOKIE_SAMESITE=Lax` menganggap `localhost`
  dan `127.0.0.1` sebagai origin berbeda).
- `login.css` dan `register.css` belum ada di antara file yang diupload,
  jadi halaman login/register akan tampil tanpa styling sampai ditambahkan.
