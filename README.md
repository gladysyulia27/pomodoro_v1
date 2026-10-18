# 🌸 FocusME! - Gladys' Pomodoro Desktop Timer

Aplikasi Pomodoro Timer desktop dengan tampilan aesthetic kawaii yang terinspirasi dari desain hand-drawn doodle alarm clock. Dibangun menggunakan **JavaScript**, **Tailwind CSS v4**, dan dijalankan secara native sebagai aplikasi desktop menggunakan **Bun** & **Electron** (bukan dalam bentuk web browser).

![FocusME Icon](assets/icon.svg)

---

## 📑 Daftar Isi

- [✨ Fitur Utama](#-fitur-utama)
- [📦 Prasyarat Sistem](#-prasyarat-sistem)
- [⚙️ Inisialisasi & Instalasi](#️-inisialisasi--instalasi)
- [🚀 Cara Menjalankan](#-cara-menjalankan)
- [🛠️ Panduan Konfigurasi](#️-panduan-konfigurasi)
  - [1. Konfigurasi Durasi Waktu (Preset Mode)](#1-konfigurasi-durasi-waktu-preset-mode)
  - [2. Konfigurasi Ukuran & Perilaku Jendela Desktop](#2-konfigurasi-ukuran--perilaku-jendela-desktop)
  - [3. Konfigurasi Gaya & Warna (Tailwind CSS)](#3-konfigurasi-gaya--warna-tailwind-css)
  - [4. Konfigurasi Efek Suara (Audio Synthesizer)](#4-konfigurasi-efek-suara-audio-synthesizer)
- [⌨️ Tombol Pintas (Keyboard Shortcuts)](#️-tombol-pintas-keyboard-shortcuts)
- [📂 Struktur Direktori Proyek](#-struktur-direktori-proyek)
- [❓ Pemecahan Masalah (Troubleshooting)](#-pemecahan-masalah-troubleshooting)

---

## ✨ Fitur Utama

- 🎨 **Tampilan Visual Doodle**: Tampilan jam dengan bodi jam biru pastel, pita pink manis, lonceng kuning, dan karakter wajah kucing imut di tengah dial jam.
- ⏱️ **3 Mode Fokus Terintegrasi**:
  - ☕ **Break Mode** (Istirahat sejenak - default 5 menit)
  - 📖 **Study Mode** (Sesi belajar - default 25 menit)
  - 💼 **Work Mode** (Fokus kerja mendalam - default 50 menit)
- 🎚️ **Slider Durasi Dinamis**: Geser slider untuk menyesuaikan durasi waktu (1 - 90 menit) dengan teks waktu retro pixel `"5 min"`.
- 🕰️ **Jarum Jam Interaktif & Beranimasi**: Jarum jam berputar secara proporsional sesuai sisa waktu sesi pomodoro, dilengkapi efek animasi bergetar (_ticking_) dan dering (_ringing_).
- 🔔 **Sintesis Audio Chime Kawaii**: Notifikasi suara lonceng arpeggio lembut saat sesi berakhir & suara pop saat tombol diklik (menggunakan Web Audio API, 100% offline).
- 🔥 **Focus Streak & Statistik**: Klik tombol api di kiri atas untuk melihat streak harian, jumlah sesi selesai, dan total menit fokus. Data tersimpan otomatis di penyimpanan lokal (_localStorage_).
- 📌 **Always on Top (Pin)**: Sematkan jendela aplikasi di atas jendela kerja/editor coding Anda.
- 💻 **Aplikasi Desktop Mandiri**: Berjalan sebagai jendela desktop independen tanpa perlu membuka browser.

---

## 📦 Prasyarat Sistem

Sebelum memulai, pastikan perangkat Anda telah terpasang:

1. **Bun** (v1.0.0 atau yang lebih baru).
   - _Windows (PowerShell):_
     ```powershell
     powershell -c "irm bun.sh/install.ps1 | iex"
     ```
   - _macOS / Linux:_
     ```bash
     curl -fsSL https://bun.sh/install | bash
     ```
   - Verifikasi instalasi:
     ```bash
     bun --version
     ```

---

## ⚙️ Inisialisasi & Instalasi

Ikuti langkah-langkah berikut untuk menginisialisasi proyek dari awal:

### 1. Masuk ke Direktori Proyek

contoh:

```bash
cd d:\COOLYEAH\PROYEK\pomodoro_v1
```

### 2. Instalasi Dependensi

Jalankan perintah instalasi menggunakan Bun:

```bash
bun install
```

### 3. Unduh Binary Electron (Jika Belum Terpasang)

Jika ini instalasi pertama kali, pastikan binary Electron telah diunduh:

```bash
bun run node_modules/electron/install.js
```

### 4. Kompilasi Tailwind CSS

Kompilasi berkas style Tailwind CSS:

```bash
bun run build:css
```

---

## 🚀 Cara Menjalankan

Anda dapat menjalankan aplikasi menggunakan salah satu perintah di bawah ini:

### 1. Mode Standar / Produksi

```bash
bun start
```

Perintah ini akan mengompilasi CSS terbaru dan langsung membuka jendela desktop **FocusME!**.

### 2. Mode Pengembangan (Development)

```bash
bun run dev
```

### 3. Mode Pantau CSS (Watch Mode)

Jika Anda sedang mengubah kelas Tailwind atau style CSS dan ingin otomatis terkompilasi setiap kali file disimpan:

```bash
bun run watch:css
```

### 4. Menjalankan Langsung via Entrypoint Bun

```bash
bun run index.ts
```

### 5. Menjalankan Pengujian (Automated Tests & 100% Coverage)

Untuk menjalankan seluruh unit test lengkap dengan laporan coverage:

```bash
bun run test
# atau langsung:
bun test --coverage
```

---

## 🛠️ Panduan Konfigurasi

### 1. Konfigurasi Durasi Waktu (Preset Mode)

#### A. Melalui Tampilan Aplikasi (UI)

1. Klik tombol **Info (i)** di pojok kanan atas jendela aplikasi.
2. Pada bagian **"Durasi Bawaan (Menit)"**, Anda dapat langsung mengubah durasi untuk:
   - ☕ Break
   - 📖 Study
   - 💼 Work
3. Nilai ini akan tersimpan otomatis di perangkat Anda.

#### B. Melalui Berkas Kode

Buka berkas [`src/app.js`](src/app.js) pada bagian objek `state`:

```javascript
const state = {
  mode: "break",
  durations: {
    break: 5, // Ubah durasi istirahat (menit)
    study: 25, // Ubah durasi belajar (menit)
    work: 50, // Ubah durasi kerja (menit)
  },
  // ...
};
```

---

### 2. Konfigurasi Ukuran & Perilaku Jendela Desktop

Pengaturan jendela desktop dapat disesuaikan pada berkas [`main.js`](main.js):

```javascript
mainWindow = new BrowserWindow({
  width: 410, // Lebar awal jendela (px)
  height: 480, // Tinggi awal jendela (px)
  resizable: true, // Apakah ukuran jendela dapat diubah
  minWidth: 380, // Lebar minimum
  minHeight: 460, // Tinggi minimum
  maxWidth: 520, // Lebar maksimum
  maxHeight: 600, // Tinggi maksimum
  frame: false, // false = frameless modern (tanpa border default OS)
  backgroundColor: "#FAF0CC", // Warna latar saat memuat
  alwaysOnTop: false, // Atur true jika ingin selalu di atas sejak dibuka
  // ...
});
```

---

### 3. Konfigurasi Gaya & Warna (Tailwind CSS)

Kustomisasi warna pastel, animasi, dan komponen slider berada di [`src/style.css`](src/style.css):

- **Warna Track Slider**: ubah `background-color` pada selector `input[type="range"]::-webkit-slider-runnable-track`.
- **Warna Tombol Slider (Thumb)**: ubah `background-color` pada `input[type="range"]::-webkit-slider-thumb` (default: `#fca0b5`).
- **Animasi Jam**:
  - `@keyframes cuteBounce`: Animasi melompat saat hover.
  - `@keyframes cuteVibe`: Goyangan getar jam saat timer berjalan.
  - `@keyframes bellRinging`: Animasi dering lonceng saat waktu habis.

Setelah mengubah [`src/style.css`](src/style.css), jalankan:

```bash
bun run build:css
```

---

### 4. Konfigurasi Efek Suara (Audio Synthesizer)

Aplikasi menggunakan Web Audio API murni sehingga tidak bergantung pada file audio eksternal. Anda dapat menyesuaikan nada bel pada kelas `SoundPlayer` di [`src/app.js`](src/app.js):

```javascript
playChime() {
  // Frekuensi nada bel (Hz): C5, E5, G5, C6
  const notes = [523.25, 659.25, 783.99, 1046.50];
  // Sesuaikan durasi, volume (gain), atau bentuk gelombang (sine, triangle)
}
```

---

## ⌨️ Tombol Pintas (Keyboard Shortcuts)

| Tombol / Aksi      | Fungsi                                  |
| ------------------ | --------------------------------------- |
| **Spasi (Space)**  | Mulai (_Start_) / Jeda (_Pause_) Timer  |
| **R**              | Reset Timer kembali ke awal durasi      |
| **Klik pada Jam**  | Mulai / Jeda Timer                      |
| **Ikon 📌 (Pin)**  | Aktifkan / Matikan mode _Always on Top_ |
| **Ikon – (Min)**   | Meminimalkan jendela ke taskbar         |
| **Ikon ✕ (Close)** | Menutup aplikasi                        |

---

## 📂 Struktur Direktori Proyek

```text
pomodoro_v1/
├── assets/
│   └── icon.svg                   # Ikon vektor aplikasi FocusME!
├── src/
│   ├── app.js                     # Logika timer, audio synthesizer, event listener, & storage
│   ├── style.css                  # Sumber CSS Tailwind v4 & animasi kustom
│   └── tailwind.css               # CSS hasil kompilasi Tailwind (digunakan di HTML)
├── tests/
│   ├── app.test.ts                # Pengujian komprehensif state, DOM events, & kalender
│   ├── index.test.ts              # Pengujian entrypoint Bun launcher
│   ├── main.test.ts               # Pengujian proses utama Electron & IPC
│   ├── preload.test.ts            # Pengujian skrip bridge context preload
│   └── timer-resilience.test.ts   # Pengujian ketahanan interval ganda, drift, & onComplete
├── index.html                     # Tampilan antarmuka utama (SVG clock & My Streak calendar)
├── index.ts                       # Entrypoint Bun untuk meluncurkan aplikasi desktop
├── main.js                        # Proses utama Electron (konfigurasi window & IPC)
├── preload.js                     # Skrip bridge aman antara Electron dan Renderer
├── package.json                   # Definisi dependensi & skrip Bun (start, dev, test, lint)
├── tsconfig.json                  # Konfigurasi TypeScript untuk Bun & pengujian
└── README.md                      # Dokumentasi lengkap proyek
```

---

## ❓ Pemecahan Masalah (Troubleshooting)

1. **Jendela Electron Tidak Muncul saat `bun start`**:
   - Pastikan binary Electron telah terpasang dengan menjalankan:
     ```bash
     bun run node_modules/electron/install.js
     ```
2. **Perubahan Tampilan / CSS Tidak Terlihat**:
   - Jalankan kompilasi ulang berkas CSS:
     ```bash
     bun run build:css
     ```
3. **Notifikasi Desktop Tidak Muncul**:
   - Pastikan izin notifikasi sistem pada Windows aktif untuk aplikasi ini.
