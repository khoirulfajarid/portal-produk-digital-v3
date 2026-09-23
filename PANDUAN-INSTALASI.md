# Panduan Instalasi — Digital Product Hub v3.0

Panduan ini memindahkan aplikasi Anda ke versi baru **tanpa menyentuh aplikasi lama**. App lama tetap berjalan normal sampai Anda memutuskan pindah.

**Total waktu: ±45 menit.** Kerjakan tahapnya berurutan.

| Tahap | Isi | Waktu |
|---|---|---|
| A | Buat OAuth Client ID (untuk login Superadmin dengan Google) | 10 menit |
| B | Pasang backend di Apps Script | 10 menit |
| C | Pasang frontend di GitHub Pages | 15 menit |
| D | Daftarkan alamat GitHub Pages ke OAuth | 2 menit |
| E | Import data dari app lama | 5 menit |
| F | Konfigurasi Fonnte, testimoni, dan uji coba | 5 menit |
| G | Cutover (pindah total) | kapan saja |

> ⚠️ **Wajib pakai akun Google yang SAMA dengan app lama** (kuliahbijak.official@gmail.com). Dengan begitu semua thumbnail, dokumen, dan bukti transfer lama langsung terbaca tanpa perlu disalin.

---

## A. Buat Google OAuth Client ID

1. Buka **https://console.cloud.google.com** dan login dengan akun di atas.
2. Pojok kiri atas, klik pemilih proyek → **New Project**. Beri nama `Digital Product Hub`, lalu **Create**.
3. Menu ☰ → **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create
   - App name: nama aplikasi Anda. Support email: email Anda.
   - Developer contact: email Anda → **Save and Continue** sampai selesai.
   - Di bagian **Audience / Test users**: klik **Publish app**, atau tambahkan email Anda sebagai *Test user*.
4. Menu **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `DPH Web`
   - **Authorized JavaScript origins**: untuk sementara isi `http://localhost`. Alamat GitHub Pages ditambahkan di Tahap D.
   - Klik **Create**, lalu **salin Client ID** (berakhiran `.apps.googleusercontent.com`).

---

## B. Pasang Backend (Apps Script)

1. Buka **https://script.google.com** → **New project**. Beri nama `Digital Product Hub v3 API`.
2. Hapus isi `Code.gs`, lalu tempel **seluruh isi `Kode.gs`**. Boleh ganti nama berkas menjadi `Kode`.
3. Di bagian atas `Kode.gs`, isi:
   ```js
   const INITIAL_GOOGLE_CLIENT_ID = 'xxxx.apps.googleusercontent.com';  // dari Tahap A
   const INITIAL_SUPERADMIN_EMAIL = '';   // kosong = email pemilik script
   ```
4. Klik ikon ⚙️ **Project Settings** → **Time zone**: `(GMT+07:00) Jakarta`.
5. Pilih fungsi **`setupAppEnvironment`** → ▶ **Run** → **Review permissions** → pilih akun → **Advanced → Go to … (unsafe)** → **Allow**.
6. Buka **Execution log** dan pastikan muncul `✅ SETUP v3.0 SELESAI`, lengkap dengan link Folder dan Spreadsheet baru (`DB_Digital_Product_Hub_v3`).
7. **Deploy → New deployment** → ⚙️ **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy**, lalu **salin URL** yang berakhiran `/exec`.

> Setiap kali `Kode.gs` diubah: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.** Dengan cara ini URL `/exec` tetap sama.

---

## C. Pasang Frontend di GitHub Pages

1. Ekstrak `digital-product-hub-web.zip`. Folder hasil ekstraksi **itulah folder proyek**. Di dalamnya langsung terlihat `index.html`, `css/`, `js/`, dan `README.md`.
2. Buka `js/config.js`, lalu tempel URL `/exec` dari Tahap B:
   ```js
   window.GAS_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
3. Buat repository **Public** baru di GitHub, misalnya `portal`. **Jangan** centang README.
4. Buka terminal **di dalam folder hasil ekstraksi tadi** (bukan folder induknya). Pastikan perintah `dir` atau `ls` menampilkan `index.html` di baris teratas, lalu jalankan:
   ```bash
   git init
   git add .
   git commit -m "Upload pertama v3"
   git branch -M main
   git remote add origin https://github.com/USERNAME/portal.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (buat di github.com/settings/tokens, centang scope `repo`). Layar memang tidak menampilkan apa pun saat token ditempel. Itu normal.
5. Di repo GitHub: **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main / (root)** → **Save**. Centang **Enforce HTTPS**.
6. Tunggu 1–2 menit. Alamat situs Anda: `https://USERNAME.github.io/portal/`

---

## D. Daftarkan Alamat Situs ke OAuth

Kembali ke **Google Cloud → Credentials → DPH Web**. Di **Authorized JavaScript origins**, tambahkan:

```
https://USERNAME.github.io
```

Tulis **tanpa** `/portal` dan tanpa garis miring di akhir. Klik **Save**, lalu tunggu ±5 menit.

Setelah itu, buka `https://USERNAME.github.io/portal/#/login` → tab **Superadmin** → **Sign in with Google**.

---

## E. Import Data dari App Lama

1. Buka spreadsheet **app lama** (`DB_Digital_Product_Hub`) dan salin URL-nya.
2. Di panel Superadmin, buka **Import & Migrasi** → tempel URL tersebut.
3. Klik **Pindai (Dry-run)**. Anda akan melihat jumlah member, produk, akses, dan pesanan yang akan disalin. Pada tahap ini belum ada data yang ditulis.
4. Klik **Jalankan Import**.
5. Periksa hasilnya:
   - **CRM Member**: ±400–500 member lama muncul dengan status "belum lengkap".
   - **Produk**: Video Series sudah berubah menjadi **Kelas**, dan thumbnail tampil seperti di app lama.
   - Link WhatsApp Group lama otomatis dipasang ke setiap Kelas. Ganti per kelas bila grupnya berbeda: menu **Produk → Ubah**.

Hal yang perlu diketahui tentang import:

- **Aman diulang.** Data yang sudah ada dilewati, sehingga tidak ada data dobel.
- **Akun Admin lama tidak diimpor**, karena Superadmin sekarang login dengan Google.
- **Semua member perlu login ulang** (cukup email, sama seperti sebelumnya). Saat pertama membuka kelas, mereka diminta mengisi **Nama panggilan + No. WA**.

---

## F. Konfigurasi Awal

1. **Notifikasi & Fonnte**:
   - Tempel token Fonnte dan isi No. WA Admin.
   - Aktifkan WhatsApp, lalu klik **Kirim Tes**.
2. **Pengaturan**:
   - Isi **Link Web Testimoni**.
   - Isi judul dan subjudul halaman Open Access.
   - Periksa channel pembayaran.
3. **Produk**: untuk tiap Kelas/Aplikasi, isi **Link checkout Lynk.id** dan **WA Group**, lalu centang **Publik** bila ingin tampil di halaman Open Access.
4. **Aplikasi**: tambahkan slide gambar dan video preview. Unggah file source code, isi video panduan instalasi, dan tambahkan dokumen panduan.
5. **Kode Akses**: kode lama ikut diimpor dan tetap bisa dipakai. Pastikan kode di Lynk.id sama dengan yang ada di sini.
6. **Uji dengan 1 akun member**:
   - Login → isi Nama/WA → buka kelas → materi & tombol WAG tampil.
   - Coba login dengan email salah → **ditolak**.

---

## G. Cutover (Pindah Total)

1. Di **Import & Migrasi**, klik **Jalankan Import** sekali lagi. Ini menyalin member dan pesanan yang masuk ke app lama selama masa transisi.
2. Buat **Pengumuman** (popup) di app baru, lalu kirim **Blast WA** ke semua member berisi alamat baru: `https://USERNAME.github.io/portal/`
3. Di halaman Blogger lama, ganti isi embed dengan tautan atau tombol ke alamat baru.
4. App lama boleh dibiarkan atau dinonaktifkan (Apps Script lama → **Deploy → Manage deployments → Archive**). Datanya tetap aman.

---

## Kuota yang Perlu Diketahui

| Hal | Batas | Catatan |
|---|---|---|
| Email (akun @gmail.com) | **100 penerima/hari** | Blast email 500 orang otomatis dicicil ±5 hari. Utamakan WhatsApp. |
| WhatsApp Fonnte | Sesuai paket | Sisa kuota tampil di Dashboard |
| Trigger GAS | ±90 menit/hari | Pekerja blast keluar instan bila tidak ada kampanye aktif |
| Database | 10 juta sel | Persentasenya tampil di Dashboard |

## Pemecahan Masalah

| Gejala | Solusi |
|---|---|
| Tombol Google tidak muncul atau muncul error `origin_mismatch` | Ulangi Tahap D, lalu tunggu 5 menit dan hard refresh (Ctrl+Shift+R) |
| "Akun Google … tidak memiliki akses Superadmin" | Isi `INITIAL_SUPERADMIN_EMAIL`, lalu jalankan `setSuperadminEmail()` |
| Halaman tampil tetapi data kosong / "GAS_URL belum diisi" | Periksa `js/config.js`, lalu `git add . && git commit -m "fix" && git push` |
| Perubahan `Kode.gs` tidak berpengaruh | Deploy → Manage deployments → Edit → **New version** |
| Blast tidak berjalan otomatis | Dashboard → kartu Otomasi → **Pasang Trigger** |
| Import: "Spreadsheet tidak bisa dibuka" | Pastikan Apps Script baru memakai akun Google yang sama dengan pemilik spreadsheet lama |

## Update / Redeploy Frontend

```bash
git add .
git commit -m "Update"
git push
```
