# SIP — Sistem Informasi Penilaian Petugas Frontliner

Aplikasi web penilaian kinerja mingguan petugas frontliner **Bank BTN** —
Teller, Customer Service, Security, Priority Banking Teller, dan Priority
Banking Customer Service.

## Fitur

**Penilaian**
- 13 aspek dalam 3 kategori: Penampilan (20%), Kemampuan (50%), Sikap (30%)
- Atasan mengisi **angka 0–100** per aspek; skor 1–5 terisi otomatis dari
  tabel konversi resmi
- Nilai akhir skala 0–5 dengan 5 kategori: Istimewa, Sangat Baik, Baik, Cukup,
  Kurang
- Panduan kriteria lengkap tiap level skor, bisa dibuka saat menilai
- Draft dan kirim, dengan catatan per aspek dan catatan umum

**Persetujuan**
- Alur: DRAFT → DIKIRIM → DIKETAHUI → FINAL
- Manager menyatakan mengetahui, admin dapat mengunci final
- Bisa dikembalikan ke penilai untuk revisi beserta alasan

**Laporan**
- Laporan SIP siap cetak (PDF via cetak browser), dengan kolom tanda tangan
  pegawai & atasan untuk ditandatangani basah
- Rekap per periode dan per cabang, peringkat, sebaran kategori
- Ekspor otomatis lewat fitur cetak browser

**Pengelolaan**
- Login NIP + password, 4 peran: Pegawai, Supervisor, Manager, Admin
- Wajib ganti password pada login pertama
- Tambah pegawai manual & impor massal dari CSV
- Reset password, aktif/nonaktifkan akun
- Unggah foto pegawai (3×4) dengan kompresi otomatis di peramban
- Pengajuan pegawai baru oleh supervisor, disetujui admin
- Periode mingguan dibuat otomatis dari aturan resmi (bisa dikunci, aktif/nonaktif)
- Audit log untuk setiap aksi penting

## Aturan Periode

Periode penilaian **dihitung otomatis**, tidak dibuat manual. Aturannya:

1. Penilaian dilakukan setiap minggu pada **hari penilaian** yang bisa diubah
   (default: Rabu). Hari ini hanya jadwal pengisian — **bukan** penentu batas
   periode.
2. Penamaan: `Minggu ke-N <Bulan> <Tahun>` dengan N = nomor urut dalam bulan
   itu, bukan nomor minggu ISO.
3. Periode selalu **mulai tanggal 1** setiap bulan dan **berakhir hari Minggu**.
   Tidak menyeberang bulan.
4. Panjang periode pertama bergantung posisi tanggal 1 terhadap hari penilaian:
   - tanggal 1 **sebelum/tepat** hari penilaian → berakhir Minggu di minggu itu
   - tanggal 1 **setelah** hari penilaian → berakhir Minggu minggu depan
     (contoh: 1 Oktober 2026 hari Kamis, hari penilaian Rabu →
     Minggu ke-1 Oktober 2026 = **1–11 Okt**, 11 hari)
5. Periode yang kurang dari **5 hari** digabung: yang di awal bulan ke periode
   berikutnya, yang di akhir bulan ke periode sebelumnya. Contoh: 1 Nov 2026
   jatuh Minggu → digabung jadi 1–8 Nov; 30 Nov 2026 jatuh Senin → digabung
   jadi 23–30 Nov.

Hari penilaian dapat diubah admin di menu **Periode**. Mengubahnya hanya
mempengaruhi perhitungan periode berikutnya — periode yang sudah dibuat tidak
diubah, supaya penilaian dan laporan yang sudah jadi tidak rusak.

Logika ada di `src/lib/sip/periode.ts` dengan 89 unit test
(`src/lib/sip/periode.test.ts`). Untuk melihat simulasi setahun penuh:

```bash
pnpm exec tsx scripts/simulasi-periode.ts 2026 3   # tahun 2026, hari penilaian Rabu (3)
```

## Pengajuan Pegawai

Supervisor sering menemukan petugas yang belum terdaftar saat hendak menilai.
Menambah pegawai langsung bukan wewenangnya, karena data pegawai mengikat NIP
resmi — risiko NIP ganda, salah unit, atau pegawai fiktif. Jadi alurnya lewat
pengajuan:

```
Supervisor mengajukan  ->  Admin memeriksa  ->  Setujui / Tolak
                                              |
                                     disetujui: pegawai langsung aktif
```

**Aturan yang ditegakkan** (`src/lib/sip/pengajuan.ts`):

- pengaju harus SUPERVISOR, MANAGER, atau ADMIN
- unit kerja tujuan harus unit pengaju atau turunannya (KC boleh mengajukan
  untuk KCP di bawahnya; Kanwil untuk semua di bawahnya)
- NIP belum dipakai pegawai mana pun dan belum diajukan orang lain
- role hasil **selalu PEGAWAI** — tidak bisa membuat admin/supervisor
- password di-hash sejak pengajuan, jadi admin tidak perlu mengetik ulang
  dan password asli tidak pernah terlihat siapa pun
- pegawai hasil wajib mengganti password saat login pertama
- saat admin menyetujui, NIP dan email diperiksa ULANG (bisa terpakai
  sejak pengajuan dibuat)
- penolakan wajib disertai alasan minimal 5 karakter
- supervisor boleh membatalkan pengajuannya sendiri selama belum diputuskan

Setiap langkah tercatat di audit log: `AJUKAN_PEGAWAI`,
`SETUJUI_PENGAJUAN_PEGAWAI`, `TOLAK_PENGAJUAN_PEGAWAI`,
`BATAL_PENGAJUAN_PEGAWAI`.

## Tumpukan Teknologi

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Bahasa | TypeScript |
| UI | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 + driver adapter `@prisma/adapter-pg` |
| Autentikasi | bcrypt + sesi cookie httpOnly (token di-hash) |
| Validasi | Zod |
| Pengujian | Vitest |
| Deploy | Vercel |

## Menjalankan Secara Lokal

### 1. Prasyarat
- Node.js 22+
- pnpm 12+
- Akun Neon (atau PostgreSQL lain)

### 2. Pasang dependensi
```bash
pnpm install
```

### 3. Siapkan environment
```bash
cp .env.example .env.local
# lalu isi DATABASE_URL
```
Ambil connection string dengan:
```bash
neon connection-string production
```

### 4. Migrasi database & generate Prisma Client
```bash
pnpm db:migrasi        # menerapkan migrasi ke DATABASE_URL di .env.local
pnpm exec prisma generate
```

### 5. Buat akun admin pertama
```bash
ADMIN_PASSWORD='PasswordAnda123' pnpm exec tsx scripts/seed-admin.ts
```
Akun dibuat dengan penanda **wajib ganti password** saat login pertama.

### 6. Jalankan
```bash
pnpm dev          # pengembangan
pnpm build && pnpm start   # produksi
```

## Pengujian

```bash
pnpm test                        # unit test (mesin penilaian, rubrik, laporan)
pnpm exec tsc --noEmit           # pemeriksaan tipe
```

Skrip verifikasi lain (butuh `DATABASE_URL` aktif):

```bash
pnpm exec tsx scripts/test-db.ts                 # koneksi database
pnpm exec tsx scripts/test-alur-penilaian.ts     # alur penilaian end-to-end
pnpm exec tsx scripts/test-angka-100.ts          # input angka 0-100
pnpm exec tsx scripts/test-halaman-laporan.ts    # halaman laporan (HTTP)
pnpm exec tsx scripts/test-halaman-baru.ts       # halaman persetujuan/pegawai/periode
pnpm exec tsx scripts/test-fitur-baru.ts         # persetujuan, impor, reset, periode
```

## Data Contoh

Untuk mencoba aplikasi dengan data realistis:

```bash
pnpm exec tsx scripts/seed-demo.ts          # buat data contoh
pnpm exec tsx scripts/seed-demo.ts --hapus  # bersihkan
```

Akun contoh yang dibuat:

| Peran | NIP | Password |
|---|---|---|
| Supervisor | `90000001` | `DemoSIP2026` |
| Manager | `90000002` | `DemoSIP2026` |
| Pegawai | `80000001` | `DemoSIP2026` |

## Aturan Penilaian

**Konversi angka 0–100 ke skor 1–5**

| Skor | Rentang angka | Kategori |
|---|---|---|
| 5 | 99–100 | Istimewa |
| 4 | 92–98 | Sangat Baik |
| 3 | 81–91 | Baik |
| 2 | 76–80 | Cukup |
| 1 | 0–75 | Kurang |

**Nilai akhir (skala 0–5)**

```
nilai_kategori = Σ (skor_aspek × bobot_aspek)
nilai_akhir    = Σ (nilai_kategori × bobot_kategori)
```

**Kategori hasil akhir**

| Rentang | Kategori |
|---|---|
| 4,80 – 5,00 | Istimewa |
| 4,60 – 4,79 | Sangat Baik |
| 4,00 – 4,59 | Baik |
| 3,60 – 3,99 | Cukup |
| 0,00 – 3,59 | Kurang |

> **Catatan penting:** karena konversi berbasis rentang (bukan proporsional),
> selisih 1 angka di batas rentang mengubah skor satu tingkat penuh. Contoh:
> angka 91 → skor 3 → nilai akhir 2,80, sedangkan angka 92 → skor 4 →
> nilai akhir 3,70. Ini konsekuensi dari tabel resmi, bukan kesalahan
> perhitungan. Nilai akhir maksimum yang dapat dicapai adalah 4,60 kecuali
> hampir semua aspek mendapat angka 99–100.

## Impor Pegawai dari CSV

Format kolom (baris pertama wajib judul):

```
NIP,Nama,Cabang,Jabatan,Role
80000010,Andi Wijaya,0001,TELLER,PEGAWAI
80000011,Rina Sari,0002|Cabang Bandung,CS,PEGAWAI
```

- **Cabang** — isi kode yang sudah ada (mis. `0001`), atau `kode|Nama` untuk
  membuat cabang baru otomatis
- **Jabatan** — kode: `TELLER`, `CS`, `SECURITY`, `PB_TELLER`, `PB_CS`
- **Role** — `PEGAWAI`, `SUPERVISOR`, `MANAGER`, `ADMIN`
- Password awal dibuat acak dan **hanya ditampilkan sekali** setelah impor

## Deploy ke Vercel

1. Push repo ke GitHub
2. Impor project di Vercel
3. Tambahkan environment variable `DATABASE_URL` (dari `.env.local`)
4. Deploy

Jalankan migrasi sekali setelah deploy:
```bash
pnpm db:migrasi --url "<DATABASE_URL produksi>"
```

> **Mengapa migrasi tidak dijalankan otomatis saat build?**
> Sebelumnya `prisma migrate deploy` ikut dijalankan di dalam build Vercel.
> Ternyata itu rapuh: Prisma memakai `pg_advisory_lock` dan Neon memakai
> connection pooler (pgbouncer), sehingga dua build yang berjalan bersamaan
> membuat kunci menggantung dan build GAGAL dengan error P1002 — walau
> kodenya benar. Sekarang build hanya meng-generate Prisma Client (tidak
> membutuhkan akses database), dan migrasi dijalankan secara sadar.
>
> Bila menemui error P1002, jalankan:
> ```bash
> pnpm exec tsx scripts/cek-lock.ts        # lihat siapa pemegang kunci
> pnpm exec tsx scripts/bebaskan-lock.ts   # putuskan koneksi yang menggantung
> pnpm db:migrasi                          # ulangi migrasi
> ```

## Struktur Proyek

```
src/
  app/
    actions/          server action: auth, penilaian, persetujuan, pegawai, periode
    masuk/            halaman login
    ubah-password/    ganti password wajib
    dasbor/           ringkasan & statistik
    penilaian/        daftar petugas + form penilaian 13 aspek
    persetujuan/      tinjau & setujui (manager/admin)
    laporan/          rekap + halaman cetak PDF
    pegawai/          kelola pegawai, impor CSV
    periode/          kelola periode mingguan
  components/         komponen UI
  lib/
    sip/              mesin penilaian, rubrik, penyusun laporan
    auth.ts           hash password, sesi, audit log
    db.ts             Prisma client singleton
prisma/
  schema.prisma       skema database
scripts/              seed & skrip verifikasi
```

## Lisensi

Perangkat lunak internal PT Bank Tabungan Negara (Persero) Tbk.
