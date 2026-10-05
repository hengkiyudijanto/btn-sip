# Modul Konten Sosmed (TikTok & Instagram)

Modul kirim konten untuk Bank BTN SIP. Kreator mengunggah gambar/video, mengajukan
untuk disetujui, penyetuju memutuskan, lalu konten dikirim ke platform.

## Alur status

```
DRAFT ──ajukan──► MENUNGGU ──setujui──► DISETUJUI ──kirim──► DIKIRIM
  ▲                  │                     │  ▲
  │                  │ minta revisi        │  └──jadwalkan──► DIJADWALKAN
  │                  ▼                     │        (batal jadwal kembali)
  └────tarik──── REVISI ◄──minta revisi─────┘
```

- **Minta revisi boleh berkali-kali** — dari MENUNGGU maupun dari DISETUJUI
  (selama belum dikirim). Setiap revisi menambah `jumlahRevisi`.
- **Pengiriman adalah langkah terpisah** dari persetujuan. Kegagalan API
  TikTok/Instagram **tidak** membatalkan status DISETUJUI, supaya bisa dicoba
  ulang tanpa mengulang approval.
- Semua aturan transisi hidup di satu tempat: `src/lib/sosmed/status.ts`
  (`transisiStatus`), dengan unit test di `status.test.ts`. Jangan menulis
  perbandingan status sendiri di halaman/action.

## Siapa boleh apa

| | Kreator (SUPERVISOR) | Penyetuju (MANAGER) | Admin | Pengamat |
|---|---|---|---|---|
| Buat / ubah konten sendiri | ✅ | ✅ | ✅ | ❌ |
| Ajukan / tarik pengajuan | ✅ (miliknya) | ✅ (miliknya) | ✅ | ❌ |
| Setujui / minta revisi | ❌ (tidak boleh milik sendiri) | ✅ | ✅ | ❌ |
| Kirim ke platform | ✅ (miliknya) | ✅ | ✅ | ❌ |
| Lihat semua konten | ❌ | ✅ | ✅ | ✅ |
| Pengaturan platform | ❌ | ❌ | ✅ | ❌ |

Kemampuan didefinisikan di `src/lib/sip/akses.ts`: `kelola_konten`,
`setujui_konten`, `lihat_semua_konten`, `kelola_sosmed`. Cakupan data per baris
ada di `src/lib/sosmed/akses.ts` (`bolehKonten`, `bolehLihatKonten`, `whereCakupan`).

> **Penting:** cakupan data memakai KEMAMPUAN (`lihat_semua_konten`), bukan
> `role === 'ADMIN'`. Pola lama itu pernah membuat PENGAMAT kehilangan grafiknya
> — jangan diulang di modul ini.

**Menyembunyikan tombol bukan pengamanan.** Setiap server action memanggil
`bolehEfek`/`bolehKonten` sebelum mengubah data, karena action bisa dipanggil
langsung lewat POST.

## Penyetuju dikunci saat pengajuan

`penyetujuId` diisi kreator dan **dikunci** waktu konten diajukan. Setelah itu
konten hanya bisa disetujui orang tersebut. Alasannya: tanpa penguncian, draf
bisa "diarahkan ulang" ke penyetuju yang lebih longgar setelah dibuat, dan
jejak persetujuan jadi tidak bermakna.

## Adapter pengiriman (mock vs nyata)

`src/lib/sosmed/penerbit.ts` memilih adapter per platform:

| Kondisi | Adapter |
|---|---|
| `config/sosmed.json` modus `mock` | simulasi (tidak mengunggah apa pun) |
| modus `nyata` + kredensial lengkap | `instagram-graph` / `tiktok-content-posting` |
| modus `nyata` + kredensial belum lengkap | **jatuh ke mock** dengan catatan di pesan hasil |

Kredensial **tidak disimpan di database** — tulis di `config/sosmed.json`
(sudah di `.gitignore`), status dibaca halaman `/sosmed/pengaturan` tanpa
menampilkan tokennya.

Adapter mock sengaja punya jalur gagal (1 dari 5 konten) supaya tombol "coba
kirim lagi" benar-benar teruji, bukan cuma ada di kode.

### Batasan platform yang divalidasi lebih dulu

`periksaKelayakan()` di `status.ts` menolak sebelum memanggil API:

- TikTok **hanya video** (gambar ke TikTok ditolak; dropdown TikTok dinonaktifkan
  otomatis saat berkas yang dipilih gambar).
- Caption maks 2200 karakter (kedua platform).
- Instagram feed hanya **JPEG** — karena itu gambar selalu dikonversi ke JPEG di
  peramban, bukan di server.
- Batas ukuran berkas dan durasi video per platform.

## Penyimpanan berkas

Media disimpan sebagai data URL di kolom `KontenSosmed.mediaData` (Vercel tidak
punya filesystem permanen), dengan pola yang sama seperti foto pegawai:

1. Dikompres/dibaca di **peramban** (`src/lib/sosmed/media.ts`): gambar
   dikonversi ke JPEG maks lebar 1440 px; video tidak dikompres (batas 20 MB).
2. Dikirim ke server sebagai data URL, divalidasi ulang di server action.
3. Disajikan lewat route `GET /sosmed/media/[id]` (bukan ditanam di HTML) supaya
   peramban meng-cache dan HTML tidak membengkak.

**Kolom ini bukan tempat untuk video besar.** Kalau pemakaian membengkak,
pindahkan ke object storage — hanya route media yang perlu diubah.

## Perintah

```bash
pnpm test                                   # seluruh unit test (termasuk mesin status & adapter)
pnpm exec tsx scripts/uji-siapkan-sosmed.ts # akun uji: UJISM1 kreator, UJISM2 penyetuju, UJISM3 pegawai
pnpm exec tsx scripts/uji-siapkan-sosmed.ts --hapus
pnpm exec tsx scripts/seed-sosmed.ts        # data demo konten (semua status)
pnpm exec tsx scripts/seed-sosmed.ts --hapus
pnpm exec tsx scripts/test-alur-sosmed.ts   # uji aturan + alur lewat data
pnpm exec tsx scripts/uji-server-action-sosmed.ts  # proteksi peran & halaman
pnpm exec tsx scripts/diagnosa-sesi.ts      # "kenapa sesi hilang / konten tidak tersimpan?"
pnpm exec tsx scripts/cek-konten.ts         # inspeksi konten terakhir
```

Password akun uji: `UjiSosmed123` (dibuat dengan `harusGantiPassword=false`).

## Jebakan yang sudah memakan waktu

- **Klik tombol di peramban lewat skrip:** `querySelector('button[type=submit]')`
  mengambil tombol **pertama di halaman**, dan di aplikasi ini itu tombol
  **Keluar** di bilah atas. Akibatnya skrip "Simpan" malah logout (sesi
  di-revoke, halaman pindah ke `/masuk`) — persis seperti kegagalan sesi padahal
  bukan. Ambil tombol dari dalam form yang benar:
  `[...document.querySelectorAll('form')].find(f => f.querySelector('input[name=judul]'))`.
- **`prisma migrate dev` butuh `-n`, bukan `--name`** (Prisma 7 mengabaikan
  `--name` dan keluar dengan kode 0 sambil hanya mencetak help).
- **Server action tidak bisa diimpor dari skrip `tsx`** (memakai `next/headers`).
  Uji aturannya lewat fungsi murni, atau panggil lewat HTTP.
- **Field JSON `hasilKirim` bertipe `unknown`** — baca lewat type guard di
  `src/lib/sosmed/hasil.ts`, jangan cast langsung di komponen.
- **Nama kolom media di halaman daftar:** Prisma hanya mengenal `mediaByte` /
  `mediaData`; `mediaUrl` bukan kolom (URL dibentuk di halaman dari `id`).

## Belum dikerjakan (perlu sebelum produksi)

1. **URL media publik.** Route `/sosmed/media/[id]` masih butuh sesi login,
   sedangkan TikTok/Instagram menarik berkas dari URL. Perlu token sekali-pakai
   berumur pendek khusus pengiriman.
2. **`NEXT_PUBLIC_APP_URL`** harus disetel, kalau tidak URL media menunjuk
   localhost dan platform tidak bisa mengambil berkasnya.
3. **Refresh token otomatis** (Meta ~60 hari, TikTok refresh token).
4. **Pengiriman terjadwal** belum berjalan otomatis: status DIJADWALKAN dan
   kolom `jadwalAt` sudah ada, tetapi belum ada cron/worker yang menjalankannya.
5. **App review** TikTok Content Posting API & izin Meta.

## Catatan deploy

Modul ini menambah 5 route baru (`/sosmed`, `/sosmed/baru`, `/sosmed/[id]`,
`/sosmed/persetujuan`, `/sosmed/pengaturan`, `/sosmed/media/[id]`) dan 1 migrasi
(`20261005152915_modul_konten_sosmed`).

**Jangan taruh `prisma migrate deploy` di dalam build Vercel** — migrasi dijalankan
terpisah dari server (aturan proyek ini), dan database produksi memakai database
yang sama dengan server.
