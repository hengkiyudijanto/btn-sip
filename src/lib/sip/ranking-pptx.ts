/**
 * Membangun PPTX "Service Drill Ranking" dengan pptxgenjs.
 *
 * TATA LETAK DISALIN DARI FILE ASLI USER (sip.pptx), bukan ditiru dari
 * gambar. Angka posisi di bawah dibaca dari ppt/slides/slide2.xml lewat
 * scripts/ekstrak-tata-letak.py — kalau perlu disesuaikan, ambil ulang
 * angkanya dari file itu, jangan dikira-kira.
 *
 * Angka penting dari file asli (inci):
 *   Background (Picture 2)   0,000 ; -0,031   13,333 x 7,641
 *   Logo Danantara (Pic 7)   0,542 ;  0,441    1,777 x 0,442
 *   Logo btn (Picture 9)    11,294 ; -0,081    1,498 x 1,486
 *   Judul (TextBox 16)       3,576 ;  0,344    6,225 x 0,841
 *   Kotak unit (Group 20)    5,039 ;  1,259    3,271 x 0,505
 *   Nama posisi (TxtBox 13)  5,219 ;  1,839    2,896 x 0,404
 *   Legenda (Group 5)        3,098 ;  6,477    6,861 x 0,990
 *   Daftar (Group 98)        1,593 ;  1,965    9,454 x 4,604
 *   Kotak foto (Pic 24)      1,608 ;  2,110    1,191 x 0,962
 *
 * Perbedaan yang SENGAJA dari file asli:
 *   - Judul di file asli ditulis "Service Drill" lalu ada kotak putih berisi
 *     "Ranking" bertumpuk di atasnya, sehingga saling menimpa dan terbaca
 *     seperti cacat cetak. Di sini ditulis rapi satu kesatuan.
 */

import PptxGenJS from 'pptxgenjs';
import type { DataRanking } from './ranking';
import { BACKGROUND, LOGO_DANANTARA, LOGO_BTN } from './ranking-gambar';
import { ringkasNama } from './nama-petugas';
import { perbaikiEfekBayanganPptx } from './bayangan-pptx';

// ---- warna ----
const BIRU_TUA = '1226AA';
const BIRU_KOTAK_NAMA = '2E4FD6';

/**
 * Komposisi kotak nilai: pita "biru berpendar" di tepi atas & bawah, sisanya
 * biru pekat di tengah.
 *
 * Pita pinggir masing-masing 16,5% tinggi kotak (permintaan user). Riwayatnya:
 * 6,5% -> 12% -> 16,5%. Di kotak setinggi 28,8 pt, 16,5% = 4,75 pt per sisi.
 *
 * pptxgenjs tidak punya gradasi asli (ShapeFillProps hanya 'solid' atau
 * 'none'), jadi "berpendar" dibuat dari beberapa lapis kotak tipis yang
 * makin terang ke arah tepi. Lapisnya berdekatan sehingga terlihat mulus.
 *
 * `atur` = posisi dari tepi atas kotak, `tinggi` = proporsi tinggi kotak
 * (dalam pecahan 0..1, dikalikan tinggi kotak sebenarnya saat menggambar).
 */
const PINGGIR_PROPORSI = 0.165;                    // 16,5% per pinggir
const TENGAH_PROPORSI = 1 - PINGGIR_PROPORSI * 2;  // 67%
/**
 * Jumlah lapis di tiap pita pinggir. Semakin banyak semakin halus, tapi
 * tiap lapis makin tipis. Pada pita 16,5% (4,75 pt), 5 lapis memberi
 * 0,95 pt per lapis — cukup halus tanpa jadi terlalu banyak bentuk.
 */
const LAPIS_PINGGIR = 5;

/**
 * Warna kotak nilai — nilai persis dari user.
 *
 * Komposisi:
 *   tepi atas & bawah : biru berpendar (makin terang ke arah tepi)
 *   tengah  (87%)     : #0322B8
 */
const WARNA_TENGAH_NILAI = '0322B8';
/** Warna paling terang di ujung tepi pita pinggir. */
const WARNA_PENDAR_NILAI = '7FA0F3';

/** Garis tepi kotak nilai — nilai persis dari user (#D1D1D1). */
const WARNA_BATAS_NILAI = 'D1D1D1';

/**
 * Tinggi kotak nilai. Dipakai bersama oleh kotak nilai DAN pil kategori di
 * sebelah kanannya, supaya keduanya selalu sama tinggi — dulu angkanya
 * ditulis terpisah (0,40 vs 0,52) dan jadi tidak sama.
 */
const KOTAK_NILAI_TINGGI = 0.40;

/**
 * Tebal bingkai putih di dalam kotak foto (inci). Foto ditempatkan di dalam
 * bingkai ini supaya tidak menutupi garis putihnya.
 */
const TEBAL_BINGKAI_FOTO = 0.05;

/**
 * Radius sudut kotak foto (inci). Karena fotonya diisikan KE DALAM bentuk ini
 * (bukan ditimpa), sudut foto mengikuti lengkungan ini — jadi tidak ada lagi
 * sudut bolong.
 */
const RADIUS_FOTO = 0.18;

/**
 * Jarak antar kotak foto, dalam inci.
 *
 * Jarak antar baris adalah 0,962 inci. Sebelumnya tinggi kotak foto juga
 * 0,962 sehingga kotak dua petugas bersentuhan tepat (tidak ada celah sama
 * sekali). Kotaknya dikecilkan sedikit supaya ada jarak, tapi tetap di tengah
 * barisnya.
 */
const JARAK_ANTAR_FOTO = 0.10;

/**
 * Warna alas bayangan kotak foto.
 *
 * Bentuk beralas ini diperlukan karena penampil tidak merender bayangan pada
 * bentuk yang isinya kosong — sedangkan kotak foto kita transparan.
 *
 * Warnanya sengaja lebih GELAP dari latar slide (#1226AA): kalau disamakan
 * dengan latar, bayangannya menyatu dan tidak terlihat. Alas ini hampir
 * seluruhnya tertutup foto; yang terlihat hanya bayangan yang meluber.
 */
const WARNA_ALAS_BAYANGAN = '04123F';

/**
 * Ukuran kotak foto. Tingginya = jarak antar baris dikurangi jarak pisah,
 * lebarnya mengikuti supaya proporsinya tetap.
 */
const RASIO_FOTO = 1.191 / 0.962;   // rasio asli kotak foto dari referensi

/** Bayangan untuk kotak foto dan pil kriteria. */
const BAYANGAN = {
  type: 'outer' as const,
  color: '000000',
  opacity: 0.45,
  blur: 6,
  offset: 2,
  angle: 90,          // 90 = ke bawah
};

/**
 * Skala penilaian 0..5 yang dipetakan ke panjang kotak nilai.
 * Nilai 0 -> lebar 0, nilai 5 -> lebar penuh kolom. Sesuai permintaan user:
 * panjang kotak mengikuti nilainya, jadi bar 5,00 akan penuh dan bar 3,51
 * sekitar 70% lebar kolom.
 */
const NILAI_MAKSIMUM = 5;

/**
 * Mencampur dua warna hex. `t` = 0 menghasilkan warna1, `t` = 1 menghasilkan
 * warna2. Dipakai untuk menghitung tangga warna pendar secara rata, supaya
 * tidak ada nilai warna yang dikarang.
 */
function campurWarna(warna1: string, warna2: string, t: number): string {
  const potong = (h: string) => [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  const a = potong(warna1);
  const b = potong(warna2);
  const hasil = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return hasil.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/**
 * Kotak label "SKALA PENILAIAN" — latar biru tua, teks putih.
 * Warna teks dipisah jadi konstanta supaya mudah disetel tanpa menyentuh
 * tata letaknya.
 */
const WARNA_LABEL_LEGENDA = '0F44BE';
const WARNA_TEKS_LABEL_LEGENDA = 'FFFFFF';
/**
 * Radius sudut kotak label "SKALA PENILAIAN", dalam inci.
 * Kotaknya setinggi 0,270 inci; 0,06 memberi sudut membulat tipis saja
 * sehingga sisi kanan-kirinya terlihat agak kotak, bukan seperti pil.
 */
const RADIUS_LABEL_LEGENDA = 0.06;
/**
 * Radius sudut panel putih legenda, dalam inci. Diambil dari file referensi
 * (Rounded Rectangle 83): radius relatif 24% dari tinggi panel.
 * 0,24 x 0,720 = 0,173 inci.
 */
const RADIUS_PANEL_LEGENDA = 0.173;

/**
 * Menyusun daftar lapis untuk kotak nilai.
 *
 * Struktur: pita "berpendar" di tepi atas & bawah (masing-masing
 * PINGGIR_PROPORSI), sisanya biru pekat di tengah.
 *
 * Warna pita dihitung dengan mencampur warna pekat ke warna pendar, makin
 * terang ke arah tepi — jadi bukan warna karangan, tapi tangga yang rata.
 * Dibuat fungsi (bukan konstanta datar) supaya jumlah lapisnya bisa diubah
 * lewat LAPIS_PINGGIR tanpa menyunting daftar manual.
 */
function lapisKotakNilai(): Array<{ warna: string; atur: number; tinggi: number }> {
  const hasil: Array<{ warna: string; atur: number; tinggi: number }> = [];
  const tinggiLapisPinggir = PINGGIR_PROPORSI / LAPIS_PINGGIR;

  // --- pita ATAS: dari tepi (paling terang) makin pekat ke arah tengah ---
  for (let i = 0; i < LAPIS_PINGGIR; i++) {
    // i=0 ada di tepi paling atas -> campuran paling terang
    const t = 1 - i / LAPIS_PINGGIR;
    hasil.push({
      warna: campurWarna(WARNA_TENGAH_NILAI, WARNA_PENDAR_NILAI, t),
      atur: i * tinggiLapisPinggir,
      tinggi: tinggiLapisPinggir,
    });
  }

  // --- bagian TENGAH: biru pekat merata ---
  hasil.push({
    warna: WARNA_TENGAH_NILAI,
    atur: PINGGIR_PROPORSI,
    tinggi: TENGAH_PROPORSI,
  });

  // --- pita BAWAH: dari pekat ke tepi (paling terang) ---
  for (let i = 0; i < LAPIS_PINGGIR; i++) {
    const t = (i + 1) / LAPIS_PINGGIR;
    hasil.push({
      warna: campurWarna(WARNA_TENGAH_NILAI, WARNA_PENDAR_NILAI, t),
      atur: PINGGIR_PROPORSI + TENGAH_PROPORSI + i * tinggiLapisPinggir,
      tinggi: tinggiLapisPinggir,
    });
  }

  return hasil;
}

const GRADASI_NILAI = lapisKotakNilai();
const PUTIH = 'FFFFFF';

const WARNA_KATEGORI: Record<string, string> = {
  Istimewa: '00B050',
  'Sangat Baik': '66BB6A',
  Baik: 'F57C00',
  Cukup: 'FFC107',
  Kurang: 'E51B2B',
};

// ---- ukuran slide (dari file asli: 12192000 x 6858000 EMU) ----
/**
 * Ukuran slide — PERSIS SAMA dengan file referensi.
 *
 * File referensi (sip.pptx) mendefinisikan <p:sldSz cx="12192000"
 * cy="6858000"/> = 13,33333… x 7,5 inci (16:9, 960 x 540 pt).
 *
 * Angka inci di bawah sengaja ditulis sebagai pecahan 12192000/914400 dan
 * 6858000/914400, BUKAN 13,3333 — pembulatan 4 desimal membuat lebarnya
 * meleset 30 EMU dari file referensi.
 */
const LEBAR = 12192000 / 914400;   // 13,333333... inci
const TINGGI = 6858000 / 914400;   // 7,5 inci

/**
 * Font isi slide.
 *
 * Aptos adalah font bawaan Microsoft 365 / Office 2023+. PPTX hanya menyimpan
 * NAMA font, bukan gambar hurufnya — jadi berkas ini akan memakai Aptos asli
 * saat dibuka di komputer yang punya font itu.
 *
 * Catatan: font ini TIDAK ada di server Linux tempat uji coba, sehingga
 * pratinjau render memakai font pengganti. Hasil di komputer user tetap
 * Aptos selama Microsoft Office-nya versi terbaru.
 */
const FONT = 'Aptos';

// ---- ukuran huruf (pt) — DIAMBIL DARI FILE ASLI via ekstrak-font-pptx.py ----
//
//   Judul "Service Drill Ranking"   44 pt  tebal
//   Nama unit (kotak)               20 pt  Poppins   <-- font berbeda
//   Nama posisi                     +mj-lt (ikut tema)
//   Legenda: rentang angka          10 pt  tebal
//   Legenda: nama kategori           8,5 pt biasa
//   Pil kategori (Istimewa/Kurang)  12 pt  tebal
//
// Kelima baris terakhir adalah hasil pengukuran dari file asli, bukan
// perkiraan. Kalau file aslinya berubah, jalankan ulang
// scripts/ekstrak-font-pptx.py lalu sesuaikan angka di bawah.
// Semua ukuran font sesuai file referensi, KECUALI F_NILAI yang diturunkan
// 2 pt dari aslinya (permintaan user: hanya font NILAI yang dikecilkan).
// Kalau perlu balik ke ukuran asli, ubah hanya F_NILAI.
const F_JUDUL = 44;
const F_POSISI = 18;
const F_NAMA = 16;
const F_NILAI = 18;          // asli 20 — sengaja 2 pt lebih kecil
const F_KATEGORI = 12;
const F_LEGENDA_ANGKA = 10;
const F_LEGENDA_NAMA = 8.5;
const F_PERIODE = 18;
const F_BARIS_LEGENDA = 14;
const F_LABEL_LEGENDA = 10;

/** Nama unit memakai Poppins (berbeda dari isi slide yang memakai Aptos). */
const FONT_UNIT = 'Poppins';

/**
 * Nama posisi ("Teller Service"). Di file referensi, teks ini memakai
 * typeface "+mj-lt" — yaitu font TEMA (majorFont), yang di theme1.xml
 * bernilai "Aptos Display". Slot font referensi: 38x Aptos, 5x Poppins,
 * 1x +mj-lt, dan yang +mj-lt itu justru nama posisi.
 */
const FONT_POSISI = 'Aptos Display';

// CATATAN: shrinkText sengaja TIDAK dipakai di seluruh slide ini. Opsi itu
// membuat PowerPoint mengecilkan teks otomatis kalau tidak muat, sehingga
// ukuran font yang tampil bisa berbeda dari yang diset. File referensi juga
// tidak memakainya. Kalau nanti ada teks yang meluber, lebih baik lebarkan
// kotaknya daripada menyalakan shrinkText lagi.

/**
 * Kotak nama cabang — posisi PERSIS dari file referensi (Group 20).
 *
 * PENTING: di referensi ada DUA kotak di area ini — Group 20 (3,271 x 0,505
 * di y 1,259) yang BERISI teks nama cabang, dan Rectangle 39 (3,699 x 0,713
 * di y 1,714) yang hanya bingkai kosong. Yang dipakai tampilannya adalah
 * Group 20, jadi inilah yang diikuti. Sempat tertukar dengan Rectangle 39
 * sehingga kotaknya kebesaran dan nama posisi tertelan.
 */
const NAMA_CABANG = { x: 5.039, y: 1.259, w: 3.271, h: 0.505 };
const RADIUS_NAMA_CABANG = 0.08;   // sudut membulat tipis
const F_UNIT = 18;   // asli 20 — dikurangi 2 pt atas permintaan user

/** Nilai dengan koma desimal (format Indonesia). */
function angkaID(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function latar(slide: PptxGenJS.Slide) {
  slide.background = { color: BIRU_TUA };
  // background menonjol 0,031 inci ke atas supaya pita merahnya tepat
  // menyentuh tepi bawah slide (persis seperti file asli)
  slide.addImage({
    data: `data:image/png;base64,${BACKGROUND}`,
    x: 0, y: -0.031, w: LEBAR, h: 7.641,
  });
}

/** Kop slide: dua logo, judul, kotak unit, nama posisi. */
function kop(slide: PptxGenJS.Slide, unit: string, posisi: string) {
  slide.addImage({
    data: `data:image/png;base64,${LOGO_DANANTARA}`,
    x: 0.542, y: 0.441, w: 1.777, h: 0.442,
  });

  slide.addImage({
    data: `data:image/png;base64,${LOGO_BTN}`,
    x: 11.294, y: -0.081, w: 1.498, h: 1.486,
  });

  slide.addText('Service Drill Ranking', {
    x: 3.576, y: 0.344, w: 6.225, h: 0.841,
    fontSize: F_JUDUL, bold: true, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT,
  });

  // Kotak nama cabang: latar transparan, hanya bergaris putih.
  //
  // Posisi mengikuti file referensi. Di referensi ada dua elemen bertumpuk:
  // Group 20 (y 1,259 h 0,505) dan Rectangle 39 (y 1,714 h 0,713) dengan
  // teksnya TextBox 17 (y 1,826 h 0,488). Yang TAMPIL adalah pasangan
  // Rectangle 39 + TextBox 17, jadi itulah yang dipakai di sini.
  slide.addShape('roundRect', {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y, w: NAMA_CABANG.w, h: NAMA_CABANG.h,
    fill: { type: 'none' } as never,
    line: { color: PUTIH, width: 1.25 },
    rectRadius: RADIUS_NAMA_CABANG,
  });
  // Nama cabang TIDAK bold (permintaan user) — cukup reguler
  // Nama cabang: teks di bagian ATAS kotak. Di referensi nama cabang dan
  // nama posisi berada di area yang sama (bertumpuk secara angka) karena
  // teksnya bisa mengecil sendiri; di sini shrinkText dimatikan supaya
  // ukuran font persis, jadi ruangnya dibagi dua.
  slide.addText(unit, {
    x: NAMA_CABANG.x, y: NAMA_CABANG.y, w: NAMA_CABANG.w, h: NAMA_CABANG.h,
    fontSize: F_UNIT, bold: false, color: PUTIH, align: 'center',
    valign: 'middle', fontFace: FONT_UNIT,
  });

  // Nama posisi diletakkan TEPAT DI BAWAH kotak nama cabang.
  //
  // Di file referensi angka y-nya (1,839) memang masuk ke area kotak nama
  // cabang (1,714 .. 2,427) sehingga secara angka bertumpuk, tapi di sana
  // teksnya bisa mengecil sendiri (autofit) dan posisinya diatur manual.
  // Di sini shrinkText sengaja dimatikan supaya ukuran font selalu persis,
  // jadi teksnya diletakkan di bawah kotak agar tidak saling menimpa.
  // Kotaknya tetap di posisi referensi; hanya teks posisi yang digeser.
  // Nama posisi: PERSIS di posisi referensi (TextBox 13) — terpisah di
  // bawah kotak nama cabang, bukan di dalamnya.
  slide.addText(posisi, {
    x: 5.219, y: 1.839, w: 2.896, h: 0.404,
    fontSize: F_POSISI, color: PUTIH, align: 'center', valign: 'middle',
    fontFace: FONT_POSISI,
  });
}

/**
 * Legenda SKALA PENILAIAN — SEMUA UKURAN DIAMBIL DARI FILE REFERENSI
 * (ppt/slides/slide2.xml, Group 5). Jalankan scripts/ekstrak-tata-letak.py
 * kalau perlu memeriksa ulang angkanya.
 *
 *   panel putih    x 2,850  y 6,130  6,861 x 0,720
 *   label          x 5,200  y 5,860  2,000 x 0,340
 *   titik & teks   x 3,030 / 4,460 / 5,946 / 7,399 / 8,868
 */
const LEG_PANEL = { x: 2.850, y: 6.750, w: 6.861, h: 0.720 };
// Label menempel di atas panel putih dan di-CENTER mendatar terhadap panel.
// Posisi tegaknya diturunkan 50% dari tinggi label sendiri, jadi separuh
// kotak label menempel menutupi tepi atas panel.
const LEG_LABEL = {
  x: LEG_PANEL.x + LEG_PANEL.w / 2 - 1.000,   // 1,000 = setengah lebar label
  y: LEG_PANEL.y - 0.270 + 0.270 / 2,          // turun 50% tinggi label
  w: 2.000,
  h: 0.270,
};
const LEG_X_TITIK = [3.030, 4.460, 5.946, 7.399, 8.868];
const LEG_Y_TITIK = 6.970;          // titik warna di dalam panel
const LEG_UKURAN_TITIK = 0.120;
const LEG_Y_RENTANG = 6.908;        // baris rentang angka
const LEG_Y_NAMA = 7.110;           // baris nama kategori

function legenda(slide: PptxGenJS.Slide) {
  // Panel putih legenda. Radius sudutnya diambil dari file referensi
  // (Rounded Rectangle 83): 24% dari tinggi => 0,24 x 0,720 = 0,173 inci.
  slide.addShape('roundRect', {
    x: LEG_PANEL.x, y: LEG_PANEL.y, w: LEG_PANEL.w, h: LEG_PANEL.h,
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
    rectRadius: RADIUS_PANEL_LEGENDA,
  });

  // label "SKALA PENILAIAN" — kotak berlatar biru muda (biru Telegram),
  // digambar SETELAH panel supaya tetap terlihat di atas panel.
  // Sudut label dibuat AGAK KOTAK (sebelumnya rectRadius 0,18 dari tinggi
  // 0,270 = hampir setengah tinggi, jadi sisi kanan-kirinya terlihat sangat
  // bulat seperti pil). 0,06 inci memberi sudut membulat tipis saja.
  slide.addShape('roundRect', {
    x: LEG_LABEL.x, y: LEG_LABEL.y, w: LEG_LABEL.w, h: LEG_LABEL.h,
    fill: { color: WARNA_LABEL_LEGENDA },
    line: { color: WARNA_LABEL_LEGENDA, width: 0 },
    rectRadius: RADIUS_LABEL_LEGENDA,
  });
  // Teks ditempatkan PERSIS seukuran kotaknya (fokus sama dengan kotak label),
  // jadi center-nya tepat di tengah kotak. Sebelumnya teks digeser +0,03 dari
  // posisi kotak sehingga center-nya meleset ke bawah.
  slide.addText('SKALA PENILAIAN', {
    x: LEG_LABEL.x, y: LEG_LABEL.y, w: LEG_LABEL.w, h: LEG_LABEL.h,
    fontSize: F_LABEL_LEGENDA, bold: true, color: WARNA_TEKS_LABEL_LEGENDA,
    align: 'center', valign: 'middle', fontFace: FONT,
  });

  const item: Array<[string, string]> = [
    ['4,80-5,00', 'Istimewa'],
    ['4,60-4,79', 'Sangat Baik'],
    ['4,00-4,59', 'Baik'],
    ['3,60-3,99', 'Cukup'],
    ['<3,59', 'Kurang'],
  ];

  item.forEach(([rentang, nama], i) => {
    const x = LEG_X_TITIK[i] ?? LEG_X_TITIK[0] + i * 1.43;

    // titik warna
    slide.addShape('ellipse', {
      x, y: LEG_Y_TITIK, w: LEG_UKURAN_TITIK, h: LEG_UKURAN_TITIK,
      fill: { color: WARNA_KATEGORI[nama] },
      line: { color: WARNA_KATEGORI[nama], width: 0 },
    });

    // rentang angka
    slide.addText(rentang, {
      x: x + 0.163, y: LEG_Y_RENTANG, w: 0.85, h: 0.269,
      fontSize: F_LEGENDA_ANGKA, bold: true, color: '142D64',
      valign: 'middle', fontFace: FONT,
    });

    // nama kategori
    slide.addText(nama, {
      x: x + 0.170, y: LEG_Y_NAMA, w: 1.05, h: 0.180,
      fontSize: F_LEGENDA_NAMA, color: '142D64',
      valign: 'middle', fontFace: FONT,
    });
  });
}

/** Satu slide ranking untuk satu kelompok (unit + posisi). */
function slideRanking(
  prs: PptxGenJS,
  kelompok: DataRanking['kelompok'][number],
  petaFoto: Map<string, string>,
) {
  const slide = prs.addSlide();
  latar(slide);
  kop(slide, kelompok.unit, kelompok.posisi);

  const baris = kelompok.baris;
  /**
   * Ukuran kotak foto.
   *
   * Tingginya = jarak antar baris dikurangi JARAK_ANTAR_FOTO, supaya kotak
   * dua petugas tidak bersentuhan. Sebelumnya tinggi kotak (0,962) sama
   * persis dengan jarak antar baris sehingga tidak ada celah sama sekali.
   * Lebarnya dihitung dari rasio asli supaya bentuknya tidak berubah.
   */
  const jarakBaris = 0.962;                       // jarak antar baris (inci)
  const hFoto = jarakBaris - JARAK_ANTAR_FOTO;
  const wFoto = hFoto * RASIO_FOTO;
  /** Supaya kotaknya tetap di tengah barisnya, bukan menempel ke atas. */
  const geserFoto = JARAK_ANTAR_FOTO / 2;
  const xFoto = 1.608 + (1.191 - wFoto) / 2;      // tetap di tengah kolom foto
  /**
   * Kotak di dalam bingkai putih — area isi foto. Dipakai juga oleh
   * penyiapan foto (foto-bulat.ts) sebagai ukuran kanvas.
   */
  const kotakIsiFoto = {
    x: xFoto + TEBAL_BINGKAI_FOTO,
    y: 0,                                   // diisi per baris di bawah
    w: wFoto - TEBAL_BINGKAI_FOTO * 2,
    h: hFoto - TEBAL_BINGKAI_FOTO * 2,
  };
  // Nama petugas ditulis LANGSUNG di sebelah kanan foto (permintaan user),
  // lalu kotak nilai di sebelah kanannya lagi. Sebelumnya nama dan kotak
  // nilai mulai di x yang hampir sama sehingga kotak nilainya menutupi nama.
  const xNama = xFoto + wFoto + 0.18;   // langsung di kanan foto
  // Kolom nama dikecilkan dari 2,05 jadi 1,62 inci supaya tidak bertumpuk
  // dengan kotak nilai yang digeser ke kiri (x 4,7222). Nama sudah diringkas
  // (kata pertama penuh + inisial), jadi 1,62 inci masih longgar: "Irwan A."
  // sekitar 1,0 inci, "Ahmad B. S." sekitar 1,4 inci.
  const wNama = 1.62;
  const yAwal = 2.110;
  const jarakStandar = 0.962;
  // kalau lebih dari 4 orang, baris dirapatkan supaya tetap dalam area daftar
  const tinggiArea = 4.604;
  const jarak = baris.length > 4 ? tinggiArea / baris.length : jarakStandar;

  // kotak nilai dimulai setelah kolom nama
  // xKotak: tepi kiri kotak nilai dibuat SEJAJAR dengan huruf "r" pada kata
  // "Service" di judul slide (permintaan user). Posisinya diukur dari hasil
  // render (scripts/cari-huruf-r.py) karena judul ditulis di tengah kotaknya
  // sehingga tepi kiri kotak judul bukan tempat huruf "S" dimulai.
  // Lebar kolom tetap supaya skala batang 0..5 tidak berubah.
  const xKotak = 4.7222;
  const wKotak = 4.35;
  const xKategori = xKotak + wKotak + 0.14;
  const wKategori = 1.30;
  // garis tegak pemisah, tepat di antara kolom nama dan kotak nilai
  const xGaris = xNama + wNama + 0.05;

  // garis tegak pemisah
  const tinggiGaris = baris.length <= 1 ? 0.6 : (baris.length - 1) * jarak + 0.55;
  slide.addShape('rect', {
    x: xGaris, y: yAwal + 0.10, w: 0.01, h: Math.max(0.5, tinggiGaris),
    fill: { color: PUTIH }, line: { color: PUTIH, width: 0 },
  });

  baris.forEach((b, i) => {
    // Foto diletakkan di TENGAH barisnya (bukan menempel ke atas), karena
    // kotaknya sekarang lebih pendek dari jarak antar baris.
    const y = yAwal + i * jarak + geserFoto;
    kotakIsiFoto.y = y + TEBAL_BINGKAI_FOTO;

    // Alas bayangan: bentuk berisi warna latar, digambar SEBELUM foto dan
    // bingkai. Bentuk berisi ini yang membawa bayangan; fotonya menutupinya,
    // jadi yang terlihat hanya bayangan yang meluber ke luar. Tanpa alas ini
    // bayangannya tidak muncul, karena bentuk transparan tidak diberi bayangan
    // oleh penampil.
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { color: WARNA_ALAS_BAYANGAN },
      line: { color: WARNA_ALAS_BAYANGAN, width: 0 },
      rectRadius: RADIUS_FOTO,
      shadow: BAYANGAN,
    });

    // Bingkai foto: latar transparan, hanya garis putih, digambar setelah
    // alas sehingga berada di atasnya. Kalau petugas belum punya foto,
    // yang terlihat adalah alas berbayangan itu.
    slide.addShape('roundRect', {
      x: xFoto, y, w: wFoto, h: hFoto,
      fill: { type: 'none' } as never,
      line: { color: PUTIH, width: 1.25 },
      rectRadius: RADIUS_FOTO,
    });
    const foto = petaFoto.get(b.nip);
    if (foto) {
      // Foto ditempel sebagai gambar biasa. Sudutnya SUDAH membulat dan
      // tembus pandang karena fotonya disiapkan lebih dulu di sisi server
      // (src/lib/sip/foto-bulat.ts, memakai sharp) — jadi tidak ada lagi
      // sudut bolong, dan hasilnya tampil sama di semua penampil.
      //
      // Ukurannya persis sama dengan kotak, jadi tidak perlu dihitung lagi.
      slide.addImage({
        data: `data:image/png;base64,${foto}`,
        x: xFoto, y, w: wFoto, h: hFoto,
      });
    }

    // Nama petugas — di sebelah kanan foto. Ditulis RINGKAS: kata pertama
    // penuh, kata berikutnya hanya huruf depannya ("Irwan Allo" -> "Irwan A.")
    slide.addText(ringkasNama(b.nama), {
      x: xNama, y, w: wNama, h: hFoto,
      fontSize: F_NAMA, bold: true, color: PUTIH, valign: 'middle',
      align: 'left', fontFace: FONT, wrap: false,
    });

    // Kotak nilai: gradasi biru LEBIH MUDA di atas & bawah, biru sekarang
    // di tengah. Bagian tengah (biru sekarang) mengambil 50% tinggi kotak,
    // sisanya 50% dibagi rata untuk ke dua sisi (25% atas, 25% bawah).
    // Dibuat bertingkat karena pptxgenjs tidak punya gradasi asli.
    const kotakAtas = y + hFoto / 2 - KOTAK_NILAI_TINGGI / 2;
    const kotakTinggi = KOTAK_NILAI_TINGGI;
    // Panjang kotak nilai MENGIKUTI NILAINYA (skala 0..5 -> 0..lebar penuh).
    // Nilai 5,00 akan penuh; 3,51 jadi sekitar 70% lebar kolom.
    const porsiNilai = Math.max(0, Math.min(1, b.nilai / NILAI_MAKSIMUM));
    const wKotakIsi = wKotak * porsiNilai;

    // Tiap lapis digambar sesuai porsinya. TIDAK ada tambahan tinggi di sini:
    // dulu tiap lapis ditambah 0,01 inci supaya tidak ada celah, tapi sejak
    // jumlah lapisnya jadi 7, tambahan itu menumpuk sehingga total kotaknya
    // melebihi 0,400 inci (122%). Celah tipis tidak terjadi karena lapisnya
    // bersinggungan tepat dan garis tepinya tidak berisi.
    for (const lapis of GRADASI_NILAI) {
      slide.addShape('rect', {
        x: xKotak,
        y: kotakAtas + lapis.atur * kotakTinggi,
        w: wKotakIsi,
        h: lapis.tinggi * kotakTinggi,
        fill: { color: lapis.warna },
        line: { color: lapis.warna, width: 0 },
      });
    }
    // Garis tepi kotak nilai: #D1D1D1, 0,5 pt — hanya mengelilingi bagian
    // yang terisi (sepanjang nilainya), BUKAN kolom penuh. Bingkai samar
    // sepanjang kolom 0..5 sudah dihapus atas permintaan user: kotaknya
    // sebesar ukurannya saja.
    slide.addShape('rect', {
      x: xKotak, y: kotakAtas, w: wKotakIsi, h: kotakTinggi,
      fill: { type: 'none' } as never,
      line: { color: WARNA_BATAS_NILAI, width: 0.5 },
    });
    // Angka nilai ditulis di UJUNG kotak, menempel pada batangnya.
    slide.addText(angkaID(b.nilai), {
      x: xKotak, y: kotakAtas, w: Math.max(wKotakIsi - 0.08, 0.60),
      h: KOTAK_NILAI_TINGGI,
      fontSize: F_NILAI, bold: true, color: PUTIH, align: 'right',
      valign: 'middle', fontFace: FONT,
    });

    // Kriteria (pil) ditempatkan di samping KANAN kotak nilai — jadi x-nya
    // mengikuti ujung batang, bukan posisi tetap. Nilai kecil berarti pil
    // ikut bergeser ke kiri.
    const kat = b.kategori;
    const pilAtas = y + hFoto / 2 - KOTAK_NILAI_TINGGI / 2;
    const xPil = xKotak + wKotakIsi + 0.14;
    slide.addShape('roundRect', {
      x: xPil, y: pilAtas, w: wKategori, h: KOTAK_NILAI_TINGGI,
      fill: { color: WARNA_KATEGORI[kat] ?? WARNA_KATEGORI.Kurang },
      line: { color: PUTIH, width: 1 }, rectRadius: KOTAK_NILAI_TINGGI / 2,
      shadow: BAYANGAN,
    });
    slide.addText(kat, {
      x: xPil, y: pilAtas, w: wKategori, h: KOTAK_NILAI_TINGGI,
      fontSize: F_KATEGORI, bold: true, color: PUTIH, align: 'center',
      valign: 'middle', fontFace: FONT,
    });
  });

  legenda(slide);
}

/** Slide pembuka: ringkasan filter. */
function slideRingkasan(prs: PptxGenJS, data: DataRanking) {
  const slide = prs.addSlide();
  latar(slide);
  kop(slide, data.unit, data.posisi);

  slide.addText(data.periode, {
    x: 3.576, y: 2.38, w: 6.225, h: 0.4,
    fontSize: F_PERIODE, color: PUTIH, align: 'center', fontFace: FONT,
  });

  const baris: Array<[string, string]> = [
    ['Jenis kantor', data.jenisKantor],
    ['Unit / cabang', data.unit],
    ['Posisi dinilai', data.posisi],
    ['Periode', data.periode],
    ['Jumlah peserta', String(data.jumlahPeserta)],
  ];
  baris.forEach(([label, nilai], i) => {
    const y = 2.95 + i * 0.5;
    slide.addText(label, {
      x: 3.9, y, w: 2.2, h: 0.4,
      fontSize: F_BARIS_LEGENDA, color: PUTIH, align: 'right', fontFace: FONT,
    });
    slide.addText(': ' + nilai, {
      x: 6.2, y, w: 4.0, h: 0.4,
      fontSize: F_BARIS_LEGENDA, bold: true, color: PUTIH, fontFace: FONT,
    });
  });

  legenda(slide);
}

/** Bangun seluruh berkas PPTX, kembalikan sebagai Buffer. */
export async function bangunPptxRanking(
  data: DataRanking,
  petaFoto: Map<string, string>
): Promise<Buffer> {
  const prs = new PptxGenJS();
  prs.defineLayout({ name: 'LAYAR', width: LEBAR, height: TINGGI });
  prs.layout = 'LAYAR';

  slideRingkasan(prs, data);
  for (const k of data.kelompok) {
    slideRanking(prs, k, petaFoto);
  }

  const keluaran = (await prs.write({ outputType: 'nodebuffer' })) as Buffer;

  // pptxgenjs mengalikan satuan bayangan pt -> EMU DUA KALI, sehingga
  // bayangannya tidak terlihat. Nilainya dihitung ulang setelah berkas jadi.
  return perbaikiEfekBayanganPptx(keluaran);
}
