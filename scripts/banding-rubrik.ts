/**
 * Bandingkan rubrik di aplikasi dengan data yang dikirim user (verbatim
 * dari foto dokumen SIP).
 *
 * Data di sini ditulis APA ADANYA dari foto — tidak diperbaiki, tidak
 * diseragamkan. Tujuannya menemukan perbedaan, bukan membenarkan aplikasi.
 *
 * Jalankan: pnpm exec tsx scripts/banding-rubrik.ts
 */
import { RUBRIK } from '../src/lib/sip/rubrik';

// ============================================================
// DATA DARI FOTO USER (verbatim, termasuk yang tampak bermasalah)
// ============================================================

type Sel = { skor: number; rentang: string; kriteria: string };

const FOTO: Record<string, { nama: string; sel: Sel[] }> = {
  A1: {
    nama: 'Kerapihan Seragam & Kelengkapan Atribut',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Seragam sangat rapi, bersih, tidak kusut, ukuran/pemakaian sesuai ketentuan, seluruh atribut lengkap dan terpasang dengan benar.' },
      { skor: 4, rentang: '92-98', kriteria: 'Seragam rapi dan bersih, terdapat ketidaksempurnaan minor seperti sedikit kusut atau 1 atribut tidak digunakan (mis. name tag), namun tidak mengganggu penampilan.' },
      { skor: 3, rentang: '81-91', kriteria: 'Seragam cukup rapi namun terlihat kusut/cekcek, terdapat lebih dari 1 atribut yang tidak digunakan, atau terdapat kesalahan kecil dalam pemakaian.' },
      { skor: 2, rentang: '76-80', kriteria: 'Seragam terlihat kurang rapi/berkerut, beberapa atribut tidak lengkap/tidak sesuai, kondisi tersebut cukup terlihat oleh nasabah.' },
      { skor: 1, rentang: '0-75', kriteria: 'Seragam tidak rapi/tidak sesuai ketentuan, banyak atribut tidak lengkap, salah penggunaan atribut, atau penampilan secara keseluruhan tidak mencerminkan standar profesional.' },
    ],
  },
  A2: {
    nama: 'Kebersihan Diri (Grooming)',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Kebersihan diri sangat terjaga; rambut, wajah, kuku, napas, pakaian dan penampilan keseluruhan bersih, segar, dan profesional.' },
      { skor: 4, rentang: '92-98', kriteria: 'Grooming sangat baik, terdapat ketidaksempurnaan minor namun tidak mengganggu kenyamanan maupun penampilan di hadapan nasabah.' },
      { skor: 3, rentang: '81-91', kriteria: 'Grooming cukup baik tetapi terdapat 1-2 aspek yang kurang diperhatikan, misalnya rambut kurang tertata atau kuku kurang rapi.' },
      { skor: 2, rentang: '76-80', kriteria: 'Terdapat beberapa aspek kebersihan/grooming yang kurang terjaga dan mulai terlihat oleh nasabah.' },
      { skor: 1, rentang: '0-75', kriteria: 'Kebersihan dan grooming tidak memenuhi standar, terlihat tidak terawat, dan berpotensi menimbulkan ketidaknyamanan bagi nasabah.' },
    ],
  },
  A3: {
    nama: 'Sikap Tubuh & Ekspresi',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Postur tegap dan profesional, ekspresi wajah ramah dan positif, fokus kepada nasabah, serta menunjukkan kesiapan melayani secara konsisten.' },
      { skor: 4, rentang: '92-98', kriteria: 'Postur dan ekspresi sudah sangat baik, hanya terdapat sesekali gerakan/postur kurang optimal namun tidak mengganggu pelayanan.' },
      { skor: 3, rentang: '81-91', kriteria: 'Sikap tubuh cukup baik, tetapi sesekali terlihat kurang tegap, kurang ekspresif, atau kurang fokus kepada nasabah.' },
      { skor: 2, rentang: '76-80', kriteria: 'Menunjukkan postur atau ekspresi yang kurang mendukung pelayanan, misalnya bersandar, terlihat pasif, atau ekspresi kurang ramah.' },
      { skor: 1, rentang: '0-75', kriteria: 'Sikap tubuh/ekspresi tidak mencerminkan kesiapan melayani, seperti menunjukkan ketidakpedulian, wajah tidak ramah, atau postur tidak profesional.' },
    ],
  },
  A4: {
    nama: 'Kelengkapan & Kebersihan Area Kerja',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Area kerja sangat bersih, rapi, tertata, seluruh perlengkapan tersedia dan berada pada tempatnya; tidak terdapat barang pribadi/berkas yang mengganggu.' },
      { skor: 4, rentang: '92-98', kriteria: 'Area kerja bersih dan rapi, terdapat ketidaksempurnaan minor seperti 1-2 barang yang belum tertata namun tidak mengganggu pelayanan.' },
      { skor: 3, rentang: '81-91', kriteria: 'Area kerja cukup bersih tetapi terdapat beberapa barang/berkas yang kurang tertata atau perlengkapan yang belum ditempatkan sebagaimana mestinya.' },
      { skor: 2, rentang: '76-80', kriteria: 'Area kerja terlihat kurang rapi/kotor, beberapa perlengkapan tidak tersedia atau tidak tertata sehingga mulai mengganggu kenyamanan pelayanan.' },
      { skor: 1, rentang: '0-75', kriteria: 'Area kerja kotor/berantakan, perlengkapan banyak yang tidak tersedia/tidak pada tempatnya, dan kondisi tersebut mengganggu pelayanan.' },
    ],
  },
  B1: {
    nama: 'Tes Kemampuan - Quiz',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Skor Quiz 99-100' },
      { skor: 4, rentang: '92-98', kriteria: 'Skor Quiz 91-98' },
      { skor: 3, rentang: '81-91', kriteria: 'Skor Quiz 81-91' },
      { skor: 2, rentang: '76-80', kriteria: 'Skor Quiz 76-80' },
      { skor: 1, rentang: '0-75', kriteria: 'Skor Quiz 0-75' },
    ],
  },
  B2: {
    nama: 'Kesesuaian Alur Pelayanan',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Menjalankan seluruh tahapan pelayanan sesuai SOP, urut, tepat, lancar, tanpa perlu arahan asesor.' },
      { skor: 4, rentang: '92-98', kriteria: 'Menjalankan hampir seluruh alur sesuai SOP; terdapat 1 kesalahan/kelalaian minor yang tidak berdampak terhadap proses pelayanan.' },
      { skor: 3, rentang: '81-91', kriteria: 'Menjalankan alur pelayanan dengan cukup baik, tetapi terdapat beberapa tahapan yang terlewat/kurang tepat dan masih dapat dipenuhi.' },
      { skor: 2, rentang: '76-80', kriteria: 'Terdapat beberapa kesalahan dalam urutan atau tahapan pelayanan, sehingga membutuhkan arahan/koreksi.' },
      { skor: 1, rentang: '0-75', kriteria: 'Tidak mengikuti alur pelayanan secara memadai, banyak tahapan terlewat/salah, dan membutuhkan pendampingan.' },
    ],
  },
  B3: {
    nama: 'Pengetahuan Produk & Solusi',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Memahami produk secara menyeluruh, mampu menjelaskan manfaat, fitur, ketentuan, serta memberikan solusi yang tepat dan relevan dengan kebutuhan nasabah.' },
      { skor: 4, rentang: '92-98', kriteria: 'Memahami produk dengan sangat baik dan mampu memberikan solusi yang tepat; terdapat minor gap pada detail tertentu.' },
      { skor: 3, rentang: '81-91', kriteria: 'Memahami informasi utama produk dan mampu menjelaskan solusi dasar, tetapi masih terdapat beberapa keterbatasan pada detail/ketentuan.' },
      { skor: 2, rentang: '76-80', kriteria: 'Pemahaman produk masih terbatas; mampu menjawab pertanyaan sederhana tetapi kesulitan memberikan solusi yang tepat untuk kebutuhan tertentu.' },
      { skor: 1, rentang: '0-75', kriteria: 'Tidak memahami informasi dasar produk, memberikan informasi yang kurang tepat/salah, atau tidak mampu memberikan solusi kepada nasabah.' },
    ],
  },
  B4: {
    nama: 'Ketelitian',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Sangat teliti dalam memeriksa data, dokumen, input, dan informasi; tidak terdapat kesalahan selama proses pelayanan.' },
      { skor: 4, rentang: '92-98', kriteria: 'Sangat teliti, hanya terdapat 1 kesalahan minor yang tidak berdampak pada proses/transaksi dan dapat segera dikoreksi.' },
      { skor: 3, rentang: '81-91', kriteria: 'Cukup teliti, namun terdapat beberapa kesalahan minor yang masih dapat dikoreksi sebelum berdampak kepada nasabah.' },
      { skor: 2, rentang: '76-80', kriteria: 'Beberapa kali melakukan kesalahan/kelalaian yang membutuhkan koreksi atau pengingat dari petugas lain.' },
      { skor: 1, rentang: '0-75', kriteria: 'Sering melakukan kesalahan, kurang melakukan verifikasi, atau terdapat kesalahan yang berpotensi berdampak terhadap proses pelayanan.' },
    ],
  },
  B5: {
    nama: 'Kemampuan Berkomunikasi',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Komunikasi jelas, terstruktur, mudah dipahami, aktif mendengarkan, mampu menyesuaikan bahasa dengan nasabah, dan memastikan pemahaman nasabah.' },
      { skor: 4, rentang: '92-98', kriteria: 'Komunikasi sangat jelas dan efektif; terdapat sedikit kekurangan dalam penyampaian namun tidak menghambat pemahaman nasabah.' },
      { skor: 3, rentang: '81-91', kriteria: 'Komunikasi cukup jelas, tetapi terkadang kurang terstruktur, terlalu cepat/lambat, atau kurang menggeluarkan kebutuhan nasabah.' },
      { skor: 2, rentang: '76-80', kriteria: 'Penyampaian kurang jelas/kurang terstruktur dan membutuhkan pengulangan atau klarifikasi agar nasabah memahami informasi.' },
      { skor: 1, rentang: '0-75', kriteria: 'Komunikasi tidak efektif, sulit dipahami, tidak mendengarkan dengan baik, atau informasi yang disampaikan tidak sesuai kebutuhan nasabah.' },
    ],
  },
  C1: {
    nama: 'Keramahan & Sopan Santun',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Sangat ramah, sopan, hangat, dan menunjukkan ketulusan dalam melayani sejak awal hingga akhir interaksi.' },
      { skor: 4, rentang: '92-98', kriteria: 'Ramah dan sopan secara konsisten; terdapat sedikit kekurangan dalam ekspresi namun tidak mengurangi kualitas interaksi.' },
      { skor: 3, rentang: '81-91', kriteria: 'Cukup ramah dan sopan, tetapi interaksi masih terasa formal/standar dan belum menunjukkan kehangatan secara konsisten.' },
      { skor: 2, rentang: '76-80', kriteria: 'Keramahan belum konsisten; beberapa respons/interaksi terasa datar, kurang hangat, atau kurang responsif.' },
      { skor: 1, rentang: '0-75', kriteria: 'Kurang ramah/sopan, menunjukkan sikap acuh, tidak responsif, atau terdapat perilaku yang berpotensi membuat nasabah tidak nyaman.' },
    ],
  },
  C2: {
    nama: 'Inisiatif',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Proaktif mengidentifikasi kebutuhan nasabah, menawarkan bantuan/solusi yang relevan, dan menyelesaikan kebutuhan tanpa harus menunggu instruksi.' },
      { skor: 4, rentang: '92-98', kriteria: 'Aktif menawarkan bantuan dan solusi yang relevan, dengan hanya sedikit momen yang masih menunggu arahan.' },
      { skor: 3, rentang: '81-91', kriteria: 'Menunjukkan inisiatif pada situasi umum, tetapi lebih sering menunggu permintaan atau arahan nasabah.' },
      { skor: 2, rentang: '76-80', kriteria: 'Cenderung pasif dan baru bertindak setelah mendapatkan instruksi/permintaan secara eksplisit.' },
      { skor: 1, rentang: '0-75', kriteria: 'Tidak menunjukkan inisiatif, pasif, menunggu arahan, atau tidak berupaya membantu menyelesaikan kebutuhan nasabah.' },
    ],
  },
  C3: {
    nama: 'Tata Bahasa & Intonasi',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Menggunakan bahasa yang sopan, positif, profesional, mudah dipahami, dengan intonasi hangat, jelas, dan sesuai situasi.' },
      { skor: 4, rentang: '92-98', kriteria: 'Bahasa dan intonasi sangat baik; terdapat minor penggunaan kata/intonasi yang kurang optimal tetapi tidak mengganggu interaksi.' },
      { skor: 3, rentang: '81-91', kriteria: 'Bahasa cukup baik, tetapi sesekali menggunakan istilah yang kurang tepat, terlalu formal/informal, atau intonasi kurang konsisten.' },
      { skor: 2, rentang: '76-80', kriteria: 'Sering menggunakan bahasa/intonasi yang kurang sesuai, terlalu datar/cepat/tinggi, atau membutuhkan perbaikan agar lebih profesional.' },
      { skor: 1, rentang: '0-75', kriteria: 'Bahasa atau intonasi tidak sesuai standar pelayanan, sulit dipahami, terkesan tidak sopan, defensif, atau dapat menimbulkan persepsi negatif.' },
    ],
  },
  C4: {
    nama: 'Body Language',
    sel: [
      { skor: 5, rentang: '99-100', kriteria: 'Kontak mata natural, postur terbuka, gestur positif, menghadap nasabah, ekspresi mendukung, dan seluruh bahasa tubuh konsisten menunjukkan perhatian penuh kepada Nasabah.' },
      { skor: 4, rentang: '92-98', kriteria: 'Body language sangat baik; terdapat sedikit gestur/postur yang kurang optimal namun tidak mengganggu interaksi.' },
      { skor: 3, rentang: '81-91', kriteria: 'Body language cukup baik, tetapi sesekali kurang menunjukkan perhatian, misalnya kontak mata kurang konsisten atau gestur masih kaku.' },
      { skor: 2, rentang: '76-80', kriteria: 'Sering menunjukkan body language yang kurang mendukung, seperti kontak mata, postur tertutup, terlalu banyak bergerak, atau terlihat kurang fokus.' },
      { skor: 1, rentang: '0-75', kriteria: 'Body language menunjukkan ketidakpedulian/ketidaksiapan, seperti menghindari kontak mata, membelakangi nasabah, memainkan benda, atau gestur yang tidak pantas.' },
    ],
  },
};

// ============================================================
// PERBANDINGAN
// ============================================================

// normalisasi ringan: hanya spasi, tanda hubung, dan perbedaan ejaan kecil
// yang diabaikan. Kata-kata TIDAK diubah.
function rapikan(t: string): string {
  return t
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\bdan\/atau\b/gi, 'dan/atau')
    .trim()
    .toLowerCase();
}

let bedaKriteria = 0;
let bedaRentang = 0;
const catatan: string[] = [];

console.log('=== PERBANDINGAN RUBRIK: APLIKASI vs FOTO USER ===\n');

for (const [kode, foto] of Object.entries(FOTO)) {
  const app = RUBRIK[kode];
  if (!app) {
    console.log(`XX  ${kode} (${foto.nama}) — TIDAK ADA di aplikasi!`);
    continue;
  }

  const masalah: string[] = [];

  for (const sel of foto.sel) {
    const ap = app.find((l) => l.skor === sel.skor);
    if (!ap) {
      masalah.push(`skor ${sel.skor} tidak ada di aplikasi`);
      continue;
    }
    if (rapikan(ap.kriteria) !== rapikan(sel.kriteria)) {
      masalah.push(
        `skor ${sel.skor} KRITERIA BEDA\n` +
          `        foto   : ${sel.kriteria}\n` +
          `        aplikasi: ${ap.kriteria}`
      );
      bedaKriteria++;
    }
  }

  // khusus B1: band angka disebut di dalam teks kriteria
  if (kode === 'B1') {
    const angkaF = foto.sel.map((s) => s.kriteria.match(/(\d+)-(\d+)/)?.[0]).join(' ');
    console.log(`B1 rentang di kolom "Rentang" : ${foto.sel.map((s) => s.rentang).join('  ')}`);
    console.log(`B1 rentang di teks "Kriteria" : ${angkaF}`);
    catatan.push(
      'B1: kolom Rentang menulis skor 4 = 92-98, tetapi teks kriteria menulis 91-98.'
    );
  }

  if (masalah.length === 0) {
    console.log(`ok  ${kode}  ${foto.nama} — SAMA (${foto.sel.length} baris)`);
  } else {
    console.log(`\n--  ${kode}  ${foto.nama}`);
    for (const m of masalah) console.log(`      ${m}`);
    console.log();
  }
}

console.log('\n=== RINGKASAN ===');
console.log(`  aspek dibandingkan      : ${Object.keys(FOTO).length}`);
console.log(`  sel kriteria BERBEDA    : ${bedaKriteria}`);

if (catatan.length) {
  console.log('\n=== CATATAN SUMBER (bukan perbedaan aplikasi) ===');
  for (const c of catatan) console.log(`  - ${c}`);
}
