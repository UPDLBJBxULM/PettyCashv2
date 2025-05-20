## Dokumentasi Lengkap Aplikasi PettyCash v2 - Nota Belanja dengan Gemini API

### 🔄 Pembaruan Terbaru

#### ✅ Penambahan Halaman Perencanaan

Aplikasi kini mendukung **pengajuan perencanaan belanja petty cash** melalui halaman baru yang dapat diakses di tab "Perencanaan". Fitur ini melengkapi proses pelaporan dengan menambahkan kemampuan untuk melakukan *perencanaan kebutuhan* barang sebelum belanja dilakukan.

#### Fitur Halaman Perencanaan (`perencanaan.html`):

- 📋 **Form Input Dinamis**:
  - **Pemohon, Accountable, Unit**: Dropdown dinamis dari Google Sheets.
  - **Perihal**: Input dengan *datalist* (autocomplete) dari data sebelumnya.
  - **Daftar Barang**:
    - Input nama barang, satuan, harga satuan, jumlah, dan total (dihitung otomatis).
    - Mendukung banyak item barang.
    - Currency: IDR atau USD (otomatis dikonversi).
- 📄 **Validasi Data**:
  - Validasi lengkap untuk semua field wajib termasuk format numerik.
  - Validasi real-time dan per barang.
- 🔁 **Integrasi Google Sheets**:
  - Menyimpan data rencana ke sheet `RENCANA`.
  - Menyimpan daftar barang ke sheet `GENERATEPDFRENCANA`.
- 🌐 **API Baru di Backend** (`app.py`):
  - `POST /submit/perencanaan`: Menyimpan data pengajuan ke Google Sheets.
  - `GET /fetch_pemohon`, `fetch_accountable`, `fetch_unit`, `fetch_perihal`, `fetch_satuan`, `fetch_nama_barang`: Mengambil data untuk dropdown frontend.

#### Navigasi Aplikasi:

- Halaman utama (`/`) sekarang menampilkan tab:
  - **Perencanaan**: Untuk pengajuan awal belanja.
  - **Pelaporan**: Untuk input bukti belanja menggunakan OCR.

---

### 1. Pendahuluan

Aplikasi PettyCash v2 - Nota Belanja ini adalah aplikasi web yang dirancang untuk **memudahkan proses pelaporan dan rekapitulasi keuangan** dengan cara otomatis mengekstrak **Nilai Total belanja dari struk nota** menggunakan teknologi **Optical Character Recognition (OCR)**. Aplikasi ini telah ditingkatkan dengan integrasi **Google Gemini API**, sebuah model bahasa besar (LLM) canggih, untuk menggantikan sistem OCR sebelumnya yang berbasis YOLOv11 dan Tesseract.

**Tujuan Aplikasi:**

*   **Otomatisasi Ekstraksi Nilai Total:** Mengurangi input data manual dan potensi kesalahan dalam proses pelaporan belanja.
*   **Peningkatan Efisiensi:** Mempercepat proses rekapitulasi dan pelaporan keuangan.
*   **Kemudahan Penggunaan:** Menyediakan antarmuka web yang intuitif dan mudah digunakan untuk memindai atau mengunggah nota belanja.

**Keunggulan Migrasi ke Gemini API:**

*   **Akurasi Tinggi:** Gemini API, sebagai LLM mutakhir, menawarkan akurasi OCR yang lebih tinggi dan kemampuan pemahaman konteks yang lebih baik dibandingkan metode OCR tradisional.
*   **Skalabilitas dan Performa:** Memanfaatkan infrastruktur cloud Google, Gemini API menjamin skalabilitas dan performa yang handal tanpa membebani server aplikasi lokal.
*   **Penyederhanaan Pemeliharaan:** Mengurangi kompleksitas backend aplikasi dengan menghilangkan ketergantungan pada model YOLO dan Tesseract lokal, sehingga mempermudah pemeliharaan dan pengembangan aplikasi di masa mendatang.

### 2. Arsitektur dan Komponen Aplikasi

Aplikasi ini dibangun dengan arsitektur web sederhana yang terdiri dari dua bagian utama: **Frontend** dan **Backend**, serta file konfigurasi dan dependencies.

**2.1. Frontend**

Frontend aplikasi dibangun menggunakan HTML, CSS, dan JavaScript, dan berlokasi di dalam folder `static` dan `templates` di direktori proyek:

*   **`templates/index.html`:** File HTML utama yang menyediakan antarmuka pengguna aplikasi. Fitur-fitur utama frontend meliputi:
    *   **Pengambilan Gambar Nota:** Menggunakan kamera perangkat untuk memindai nota secara langsung atau opsi untuk mengunggah gambar dari file.
    *   **Pratinjau Gambar:** Menampilkan pratinjau gambar nota yang diambil atau diunggah.
    *   **Formulir Input Data:** Formulir interaktif untuk melengkapi informasi transaksi, termasuk mata uang, jumlah (terisi otomatis oleh OCR), akun SKKO, ID rencana, uraian, dan judul laporan.
    *   **Modal Interaktif:** Menggunakan modal untuk menampilkan formulir, ringkasan data, detail rencana, pesan informasi/error, dan indikator loading.
    *   **Dropdown dan Datalist:** Menggunakan Choice.js untuk dropdown Akun SKKO dan ID Rencana yang dapat dicari, serta datalist untuk saran otomatis Judul Laporan dan Uraian.
    *   **Desain Responsif:** Tampilan aplikasi yang responsif dan optimal di berbagai ukuran layar perangkat (desktop dan mobile) menggunakan Tailwind CSS dan CSS kustom.

*   **`static/js/main.js`:** File JavaScript utama yang mengontrol logika frontend, termasuk:
    *   **Manajemen Kamera:** Mengakses dan mengontrol kamera perangkat untuk pemindaian nota, mengambil gambar, dan menampilkan pratinjau video.
    *   **Upload File:** Menangani proses upload file gambar nota dari perangkat pengguna.
    *   **Komunikasi dengan Backend (API Calls):** Melakukan panggilan API ke backend Flask untuk:
        *   Mengirim gambar nota untuk diproses oleh Gemini API (`/upload_file`).
        *   Mengambil daftar ID Rencana (`/fetch_id_rencana`).
        *   Mengambil daftar Akun SKKO (`/fetch_account_skkos`).
        *   Mengambil detail rencana berdasarkan ID Rencana (`/get_rencana_details`).
        *   Mengambil saran Judul Laporan dan Uraian (`/fetch_judul_laporan_suggestions`, `/fetch_uraian_laporan_suggestions`).
        *   Mengirim data transaksi yang sudah dilengkapi untuk disimpan (`/submit`).
    *   **Pemrosesan Respon API:** Memproses respon JSON dari backend, menampilkan data di UI, dan menangani error.
    *   **Validasi Formulir:** Melakukan validasi input formulir sebelum data dikirim ke backend.
    *   **Manajemen Modal dan UI:** Mengontrol tampilan dan interaksi modal, menampilkan pesan informasi/error, dan mengelola alur aplikasi di frontend.
    *   **Inisialisasi dan Event Handling:** Menginisialisasi komponen UI (termasuk Choice.js), menambahkan event listener untuk interaksi pengguna (tombol, input, dll.).

*   **`static/css/style.css`:** File CSS yang berisi styling kustom untuk tampilan aplikasi, dibangun di atas framework Tailwind CSS dan CSS kustom untuk elemen-elemen spesifik aplikasi.

*   **`static/images/`:** Folder yang berisi file-file gambar yang digunakan di frontend aplikasi (ikon, logo, dll.).

**2.2. Backend (File `app.py`)**

Backend aplikasi dibangun menggunakan framework web mikro **Flask** dan file utama backend adalah `app.py` di root direktori proyek:

*   **Framework Flask:** `app.py` mendefinisikan aplikasi Flask utama, menangani routing URL, logika bisnis, dan interaksi dengan layanan eksternal.
*   **API Endpoints (Rute):** `app.py` menyediakan berbagai API endpoints (rute) untuk komunikasi dengan frontend dan layanan eksternal:
    *   `/` : Menampilkan halaman utama aplikasi (`index.html`).
    *   `/upload_file` (POST) : Menerima gambar nota dari frontend, melakukan ekstraksi nilai total menggunakan **Gemini API**, dan mengembalikan hasil ekstraksi dalam format JSON.
    *   `/submit` (POST) : Menerima data transaksi dari frontend, mengunggah file nota dan bukti (jika ada) ke Google Drive melalui **Receipt API** dan **Evidence API**, menyimpan data transaksi ke **Google Sheets**, dan mengembalikan respons JSON (sukses/gagal).
    *   `/fetch_id_rencana` (GET) : Mengambil daftar ID Rencana dari sheet "RENCANA" di Google Sheets dan mengembalikan sebagai JSON.
    *   `/fetch_account_skkos` (GET) : Mengambil daftar Akun SKKO dari sheet "ACCOUNTLIST" di Google Sheets dan mengembalikan sebagai JSON.
    *   `/get_rencana_details` (GET) : Mengambil detail rencana (tanggal mulai/akhir A/R, requestor, unit, nominal) dari sheet "RENCANA" di Google Sheets berdasarkan ID Rencana yang diberikan, dan mengembalikan sebagai JSON.
    *   `/fetch_judul_laporan_suggestions` (GET) : Mengambil saran judul laporan terbaru dari sheet "REKAPREALISASI" di Google Sheets dan mengembalikan sebagai JSON (untuk fitur datalist saran judul laporan di frontend).
    *   `/fetch_uraian_laporan_suggestions` (GET) : Mengambil saran uraian laporan terbaru dari sheet "REKAPREALISASI" di Google Sheets dan mengembalikan sebagai JSON (untuk fitur datalist saran uraian laporan di frontend).
*   **Fungsi `extract_total_from_receipt_gemini(image_path)`:** Fungsi ini merupakan inti dari integrasi Gemini API. Fungsi ini melakukan langkah-langkah berikut:
    *   **Konfigurasi Gemini API:** Mengkonfigurasi library `google-generativeai` dengan API key yang diambil dari konfigurasi aplikasi.
    *   **Inisialisasi Model Gemini:** Memuat model Gemini API yang akan digunakan untuk ekstraksi teks (dalam kode saat ini menggunakan model `gemini-1.5-flash`).
    *   **Pembacaan Gambar:** Membaca gambar nota dari `image_path` menggunakan library `Pillow` dan mengubahnya menjadi format byte yang sesuai untuk Gemini API.
    *   **Pembuatan Prompt API:** Membuat prompt teks yang diinstruksikan kepada Gemini API untuk mengekstrak nilai total belanja dari gambar nota dan memberikan hasilnya hanya dalam format angka.
    *   **Pemanggilan Gemini API:** Mengirimkan permintaan ke Gemini API (gambar dan prompt) menggunakan fungsi `model.generate_content()`.
    *   **Ekstraksi Teks Respon:** Mengambil teks respon dari Gemini API (`response.text`).
    *   **Konversi ke Float (Tanpa Regex):** Mencoba mengkonversi teks respon langsung ke format float. Karena prompt sudah meminta Gemini API untuk memberikan hasil dalam format angka saja, regex tidak lagi digunakan dalam versi kode yang disederhanakan ini.
    *   **Error Handling:** Menangani potensi error selama pemanggilan API atau konversi ke float, mencatat error log, dan mengembalikan `None` jika ekstraksi nilai total gagal.
*   **Integrasi Google Sheets (Fungsi `init_gspread_client()`, `get_rencana_details_from_sheet()`, `append_to_sheet()`, `query_from_sheet()`, `get_unique_latest_entries()`):** `app.py` menggunakan library `gspread` untuk berinteraksi dengan Google Sheets API. Fungsi-fungsi ini digunakan untuk:
    *   **Otentikasi Google Sheets:** Menginisialisasi client `gspread` menggunakan credentials Service Account.
    *   **Mengambil Data Rencana dan Akun:** Membaca data dari sheet "RENCANA" dan "ACCOUNTLIST" untuk mengisi dropdown di frontend.
    *   **Menyimpan Data Transaksi:** Menambahkan baris baru ke sheet "REKAPREALISASI" untuk menyimpan data transaksi yang berhasil diproses.
    *   **Mengambil Saran Judul dan Uraian Laporan:** Mengambil data kolom Judul Laporan dan Uraian dari sheet "REKAPREALISASI" untuk memberikan saran otomatis di frontend.
    *   **Caching Sederhana:** Mengimplementasikan caching manual sederhana untuk saran Judul dan Uraian Laporan untuk mengurangi frekuensi akses ke Google Sheets.
*   **API Calls ke Layanan Eksternal (Fungsi `submit_data()`):** Fungsi `submit_data()` di `app.py` melakukan panggilan API ke layanan eksternal (Receipt API dan Evidence API) menggunakan library `requests` untuk mengunggah file nota dan bukti ke Google Drive. Endpoint API dan data yang dikirimkan diambil dari konfigurasi aplikasi dan data formulir dari frontend.
*   **Konfigurasi Aplikasi (Class `Config`, `ProductionConfig`, `DevelopmentConfig`):** `app.py` menggunakan class `Config` dan konfigurasi berbasis environment (`ProductionConfig`, `DevelopmentConfig`) untuk mengelola pengaturan aplikasi, termasuk API keys, paths, dan mode debug. Konfigurasi dimuat dari file `.env` menggunakan library `dotenv`.
*   **Logging (Konfigurasi `logging`, `RotatingFileHandler`):** `app.py` mengimplementasikan logging menggunakan library `logging` untuk mencatat aktivitas aplikasi, error, dan informasi debugging ke file `app.log`. Konfigurasi logging menggunakan `RotatingFileHandler` untuk mengelola ukuran file log dan rotasi file log.

**2.3. File Konfigurasi (`.env`)**

File `.env` di root direktori proyek digunakan untuk menyimpan konfigurasi environment yang sensitif dan spesifik untuk environment pengembangan atau produksi. File ini **tidak boleh di-commit ke repository kode publik** karena berisi informasi sensitif seperti API keys dan credentials.

Variabel environment yang perlu dikonfigurasi di `.env`:

*   **`UPLOAD_FOLDER`:** Path direktori lokal untuk menyimpan file upload sementara (misalnya, `/tmp/uploads` atau `./uploads`). Direktori ini harus writable oleh aplikasi Flask.
*   **`GOOGLE_CREDENTIALS_PATH`:** Path relatif atau absolute ke file JSON credentials Google Cloud Service Account Anda (misalnya, `./credentials/service_account_key.json`). File JSON ini harus berisi credentials Service Account yang memiliki izin akses ke Google Sheets API dan Google Drive API.
*   **`GOOGLE_SHEET_ID`:** ID Google Sheet yang digunakan untuk menyimpan data rencana, akun, dan rekap realisasi. ID ini dapat ditemukan di URL Google Sheet Anda (bagian setelah `/d/` dan sebelum `/edit`).
*   **`RECEIPT_API_ENDPOINT` (Opsional):** Endpoint API untuk layanan Receipt API Anda (jika ada). API ini digunakan untuk mengunggah file nota ke Google Drive. Jika Anda tidak memiliki Receipt API terpisah, Anda bisa mengosongkan variabel ini atau menghapusnya dari `.env` dan kode aplikasi (dengan penyesuaian kode `app.py` dan `main.js`). Contoh nilai: `https://<your-receipt-api-endpoint>/api/receipt`.
*   **`EVIDENCE_API_ENDPOINT` (Opsional):** Endpoint API untuk layanan Evidence API Anda (jika ada). API ini digunakan untuk mengunggah file bukti transaksi tambahan ke Google Drive. Jika Anda tidak memiliki Evidence API terpisah, Anda bisa mengosongkan variabel ini atau menghapusnya dari `.env` dan kode aplikasi (dengan penyesuaian kode `app.py` dan `main.js`). Contoh nilai: `https://<your-evidence-api-endpoint>/api/evidence`.
*   **`GEMINI_API_KEY`:** API key untuk mengakses Google Gemini API. API key ini didapatkan dari Google AI Studio setelah membuat project dan API key Gemini. **Variabel ini *harus diisi* dengan API key Gemini yang valid agar aplikasi dapat berfungsi dengan benar.**

**2.4. File Dependencies (`requirements.txt`)**

File `requirements.txt` berisi daftar library Python beserta versinya yang dibutuhkan oleh aplikasi. File ini digunakan oleh `pip` untuk menginstall semua dependencies yang diperlukan ke dalam virtual environment.

Library-library penting yang terdaftar di `requirements.txt` dan fungsinya telah dijelaskan di bagian **2. Komponen Aplikasi** di atas.

### 3. Pengaturan Aplikasi (Langkah-Langkah Instalasi dan Konfigurasi)

Panduan lengkap langkah-langkah pengaturan aplikasi (prasyarat, pembuatan virtual environment, instalasi dependencies, konfigurasi `.env`) telah dijelaskan secara detail di bagian **3. Pengaturan Aplikasi** pada dokumentasi sebelumnya. Silakan merujuk ke bagian tersebut untuk instruksi lengkap.

### 4. Penggunaan Aplikasi (Panduan Pengguna)

Panduan lengkap langkah-langkah penggunaan aplikasi (akses aplikasi web, upload/pindai nota, isi formulir, tinjau ulang, kirim data) telah dijelaskan secara detail di bagian **4. Penggunaan Aplikasi** pada dokumentasi sebelumnya. Silakan merujuk ke bagian tersebut untuk instruksi lengkap.

### 5. Troubleshooting (Pemecahan Masalah)

Bagian **5. Troubleshooting** pada dokumentasi sebelumnya telah menyediakan daftar masalah umum dan solusinya. Silakan merujuk ke bagian tersebut untuk panduan pemecahan masalah. Tambahan untuk troubleshooting spesifik Gemini API:

*   **Ekstraksi Nilai Total Gagal/Tidak Akurat:**
    *   **Periksa Kualitas Gambar Nota:** Pastikan gambar nota jelas, tidak buram, dan teks terbaca dengan baik. Gemini API bekerja lebih baik dengan gambar berkualitas baik.
    *   **Coba Ulangi Pemindaian/Upload:** Terkadang, kesalahan ekstraksi bisa terjadi karena variasi dalam pemrosesan gambar oleh API. Coba ulangi proses pemindaian atau upload nota.
    *   **Periksa `response.text` di Log:** Aktifkan logging raw response dan `response.text` dari Gemini API di `app.py` (seperti yang telah kita bahas sebelumnya). Periksa output log untuk melihat apa yang sebenarnya dikembalikan oleh Gemini API. Apakah API mengembalikan teks yang benar? Apakah format teks sesuai dengan yang diharapkan?
    *   **Sesuaikan Prompt Gemini API (Eksperimen):** Jika Gemini API sering gagal mengekstrak nilai total dengan benar, Anda bisa mencoba **memodifikasi prompt teks** di `extract_total_from_receipt_gemini` function di `app.py`. Coba prompt yang lebih spesifik, lebih sederhana, atau dengan instruksi yang berbeda. Eksperimen dengan prompt yang berbeda mungkin bisa meningkatkan akurasi ekstraksi.
    *   **Input Manual:** Jika Gemini API terus gagal mengekstrak nilai total secara akurat untuk jenis struk tertentu, pertimbangkan untuk memberikan opsi bagi pengguna untuk **memasukkan nilai total secara manual** sebagai fallback.

    **Made with ❤️ by ULM-Ilkom 21**