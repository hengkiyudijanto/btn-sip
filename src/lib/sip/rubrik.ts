/**
 * Rubrik penilaian SIP — deskripsi tiap level skor 1-5.
 *
 * Sumber: dokumen "SIP REPORT" Bank BTN (13 aspek).
 * Teks kriteria disimpan apa adanya sesuai dokumen resmi supaya penilai
 * melihat panduan yang sama dengan yang beredar dalam bentuk cetak.
 *
 * Catatan keputusan (disetujui pemilik produk):
 * - Band "Istimewa" diseragamkan menjadi 99-100 untuk SEMUA aspek,
 *   meskipun sebagian tabel sumber tertulis 93-100.
 * - Aspek B1 (Quiz) menerima nilai mentah 0-100 lalu dikonversi ke skor 1-5.
 */

export type LevelRubrik = {
  skor: 1 | 2 | 3 | 4 | 5;
  label: string;
  labelEn: string;
  kriteria: string;
  kriteriaEn?: string;
};

export type RubrikAspek = {
  kode: string;
  level: LevelRubrik[];
};

const LABEL: Record<number, { id: string; en: string }> = {
  5: { id: 'Istimewa', en: 'Outstanding' },
  4: { id: 'Sangat Baik', en: 'Very Good' },
  3: { id: 'Baik', en: 'Good' },
  2: { id: 'Cukup', en: 'Fair' },
  1: { id: 'Kurang', en: 'Poor' },
};

function level(skor: 1 | 2 | 3 | 4 | 5, kriteria: string): LevelRubrik {
  return { skor, label: LABEL[skor].id, labelEn: LABEL[skor].en, kriteria };
}

export const RUBRIK: Record<string, LevelRubrik[]> = {
  // ===================== A. PENAMPILAN =====================
  A1: [
    level(5, 'Seragam sangat rapi, bersih, tidak kusut, ukuran/pemakaian sesuai ketentuan, seluruh atribut lengkap dan terpasang dengan benar.'),
    level(4, 'Seragam rapi dan bersih, terdapat ketidaksempurnaan minor seperti sedikit kusut atau 1 atribut tidak digunakan (mis. name tag), namun tidak mengganggu penampilan.'),
    level(3, 'Seragam cukup rapi namun terlihat kusut/cekcek, terdapat lebih dari 1 atribut yang tidak digunakan, atau terdapat kesalahan kecil dalam pemakaian.'),
    level(2, 'Seragam terlihat kurang rapi/berkerut, beberapa atribut tidak lengkap/tidak sesuai, kondisi tersebut cukup terlihat oleh nasabah.'),
    level(1, 'Seragam tidak rapi/tidak sesuai ketentuan, banyak atribut tidak lengkap, salah penggunaan atribut, atau penampilan secara keseluruhan tidak mencerminkan standar profesional.'),
  ],
  A2: [
    level(5, 'Kebersihan diri sangat terjaga; rambut, wajah, kuku, napas, pakaian dan penampilan keseluruhan bersih, segar, dan profesional.'),
    level(4, 'Grooming sangat baik, terdapat ketidaksempurnaan minor namun tidak mengganggu kenyamanan maupun penampilan di hadapan nasabah.'),
    level(3, 'Grooming cukup baik tetapi terdapat 1-2 aspek yang kurang diperhatikan, misalnya rambut kurang tertata atau kuku kurang rapi.'),
    level(2, 'Terdapat beberapa aspek kebersihan/grooming yang kurang terjaga dan mulai terlihat oleh nasabah.'),
    level(1, 'Kebersihan dan grooming tidak memenuhi standar, terlihat tidak terawat, dan berpotensi menimbulkan ketidaknyamanan bagi nasabah.'),
  ],
  A3: [
    level(5, 'Postur tegap dan profesional, ekspresi wajah ramah dan positif, fokus kepada nasabah, serta menunjukkan kesiapan melayani secara konsisten.'),
    level(4, 'Postur dan ekspresi sudah sangat baik, hanya terdapat sesekali gerakan/postur kurang optimal namun tidak mengganggu pelayanan.'),
    level(3, 'Sikap tubuh cukup baik, tetapi sesekali terlihat kurang tegap, kurang ekspresif, atau kurang fokus kepada nasabah.'),
    level(2, 'Menunjukkan postur atau ekspresi yang kurang mendukung pelayanan, misalnya bersandar, terlihat pasif, atau ekspresi kurang ramah.'),
    level(1, 'Sikap tubuh/ekspresi tidak mencerminkan kesiapan melayani, seperti menunjukkan ketidakpedulian, wajah tidak ramah, atau postur tidak profesional.'),
  ],
  A4: [
    level(5, 'Area kerja sangat bersih, rapi, tertata, seluruh perlengkapan tersedia dan berada pada tempatnya; tidak terdapat barang pribadi/berkas yang mengganggu.'),
    level(4, 'Area kerja bersih dan rapi, terdapat ketidaksempurnaan minor seperti 1-2 barang yang belum tertata namun tidak mengganggu.'),
    level(3, 'Area kerja cukup bersih tetapi terdapat beberapa barang/berkas yang kurang tertata atau perlengkapan yang belum ditempatkan sebagaimana mestinya.'),
    level(2, 'Area kerja terlihat kurang rapi/kotor, beberapa perlengkapan tidak tersedia atau tidak tertata sehingga mulai mengganggu kenyamanan pelayanan.'),
    level(1, 'Area kerja kotor/berantakan, perlengkapan banyak yang tidak tersedia/tidak pada tempatnya, dan kondisi tersebut mengganggu pelayanan.'),
  ],

  // ===================== B. KEMAMPUAN =====================
  B1: [
    level(5, 'Skor Quiz 99-100.'),
    level(4, 'Skor Quiz 92-98.'),
    level(3, 'Skor Quiz 81-91.'),
    level(2, 'Skor Quiz 76-80.'),
    level(1, 'Skor Quiz 0-75.'),
  ],
  B2: [
    level(5, 'Menjalankan seluruh tahapan pelayanan sesuai SOP, urut, tepat, lancar, tanpa perlu arahan asesor.'),
    level(4, 'Menjalankan hampir seluruh alur sesuai SOP; terdapat 1 kesalahan/kelalaian minor yang tidak berdampak terhadap proses pelayanan.'),
    level(3, 'Menjalankan alur pelayanan dengan cukup baik, tetapi terdapat beberapa tahapan yang terlewat/kurang tepat dan masih dapat dipenuhi.'),
    level(2, 'Terdapat beberapa kesalahan dalam urutan atau tahapan pelayanan, sehingga membutuhkan arahan/koreksi.'),
    level(1, 'Tidak mengikuti alur pelayanan secara memadai, banyak tahapan terlewat/salah, dan membutuhkan pendampingan.'),
  ],
  B3: [
    level(5, 'Memahami produk secara menyeluruh, mampu menjelaskan manfaat, fitur, ketentuan, serta memberikan solusi yang tepat dan relevan dengan kebutuhan nasabah.'),
    level(4, 'Memahami produk dengan sangat baik dan mampu memberikan solusi yang tepat, terdapat minor gap pada detail tertentu.'),
    level(3, 'Memahami informasi utama produk dan mampu menjelaskan solusi dasar, tetapi masih terdapat beberapa keterbatasan.'),
    level(2, 'Pemahaman produk masih terbatas; mampu menjawab pertanyaan sederhana tetapi kesulitan memberikan solusi yang tepat untuk kebutuhan tertentu.'),
    level(1, 'Tidak memahami informasi dasar produk; memberikan informasi yang kurang tepat/salah, atau tidak mampu memberikan solusi kepada nasabah.'),
  ],
  B4: [
    level(5, 'Sangat teliti dalam memeriksa data, dokumen, input, dan informasi; tidak terdapat kesalahan selama proses pelayanan.'),
    level(4, 'Sangat teliti, hanya terdapat 1 kesalahan minor yang tidak berdampak pada proses/transaksi dan dapat segera dikoreksi.'),
    level(3, 'Cukup teliti, namun terdapat beberapa kesalahan minor yang masih dapat dikoreksi sebelum berdampak pada nasabah.'),
    level(2, 'Beberapa kali melakukan kesalahan/kelalaian yang membutuhkan koreksi atau pengingat dari petugas lain.'),
    level(1, 'Sering melakukan kesalahan, kurang melakukan verifikasi, atau terdapat kesalahan yang berpotensi berdampak terhadap proses pelayanan.'),
  ],
  B5: [
    level(5, 'Komunikasi jelas, terstruktur, mudah dipahami, aktif mendengarkan, mampu menyesuaikan bahasa dengan nasabah, dan memastikan pemahaman nasabah.'),
    level(4, 'Komunikasi sangat jelas dan efektif; terdapat sedikit kekurangan dalam penyampaian namun tidak menghambat pemahaman nasabah.'),
    level(3, 'Komunikasi cukup jelas, tetapi terkadang kurang terstruktur, terlalu cepat/lambat, atau kurang menggali kebutuhan nasabah.'),
    level(2, 'Penyampaian kurang jelas/kurang terstruktur dan membutuhkan pengulangan atau klarifikasi agar nasabah memahami informasi.'),
    level(1, 'Komunikasi tidak efektif, sulit dipahami, tidak mendengarkan dengan baik, atau informasi yang disampaikan tidak sesuai kebutuhan.'),
  ],

  // ===================== C. SIKAP =====================
  C1: [
    level(5, 'Sangat ramah, sopan, hangat, dan menunjukkan ketulusan dalam melayani sejak awal hingga akhir interaksi.'),
    level(4, 'Ramah dan sopan secara konsisten; terdapat sedikit kekurangan dalam ekspresi namun tidak mengurangi kualitas interaksi.'),
    level(3, 'Cukup ramah dan sopan, tetapi interaksi masih terasa formalis/standar dan belum menunjukkan kehangatan secara konsisten.'),
    level(2, 'Keramahan belum konsisten; beberapa respons/interaksi terasa datar, kurang hangat, atau kurang responsif.'),
    level(1, 'Kurang ramah/sopan, menunjukkan sikap acuh, tidak responsif, atau terdapat perilaku yang berpotensi membuat nasabah tidak nyaman.'),
  ],
  C2: [
    level(5, 'Proaktif mengidentifikasi kebutuhan nasabah, menawarkan bantuan/solusi yang relevan, dan menyelesaikan kebutuhan tanpa harus menunggu instruksi.'),
    level(4, 'Aktif menawarkan bantuan dan solusi yang relevan, dengan hanya sedikit momen yang masih menunggu arahan.'),
    level(3, 'Menunjukkan inisiatif pada situasi umum, tetapi lebih sering menunggu perintah atau arahan nasabah.'),
    level(2, 'Cenderung pasif dan baru bertindak setelah mendapat instruksi/permintaan secara eksplisit.'),
    level(1, 'Tidak menunjukkan inisiatif, pasif, menunggu arahan, atau tidak berupaya membantu menyelesaikan kebutuhan nasabah.'),
  ],
  C3: [
    level(5, 'Menggunakan bahasa yang sopan, positif, profesional, mudah dipahami, dengan intonasi hangat, jelas, dan sesuai situasi.'),
    level(4, 'Bahasa dan intonasi sangat baik; terdapat minor penggunaan kata/intonasi yang kurang optimal tetapi tidak mengganggu interaksi.'),
    level(3, 'Bahasa cukup baik, tetapi sesekali menggunakan istilah yang kurang tepat, terlalu formal/informal, atau intonasi kurang konsisten.'),
    level(2, 'Sering menggunakan bahasa/intonasi yang kurang sesuai, terlalu datar/cepat/tinggi, atau membutuhkan perbaikan agar lebih profesional.'),
    level(1, 'Bahasa atau intonasi tidak sesuai standar pelayanan, sulit dipahami, terkesan tidak sopan, defensif, atau dapat menimbulkan persepsi negatif.'),
  ],
  C4: [
    level(5, 'Kontak mata natural, postur terbuka, gestur positif, menghadap nasabah, ekspresi mendukung, dan seluruh bahasa tubuh konsisten menunjukkan perhatian penuh kepada nasabah.'),
    level(4, 'Body language sangat baik; terdapat sedikit gestur/postur yang kurang optimal namun tidak mengganggu interaksi.'),
    level(3, 'Body language cukup baik, tetapi sesekali kurang menunjukkan perhatian, misalnya kontak mata kurang konsisten atau gestur masih kaku.'),
    level(2, 'Sering menunjukkan body language yang kurang mendukung, seperti kontak mata, postur tertutup, terlalu banyak bergerak, atau terlalu kurang fokus.'),
    level(1, 'Body language menunjukkan ketidakpedulian/ketidaksiapan, seperti menghindari kontak mata, membelakangi nasabah, memainkan benda, atau gestur yang tidak pantas.'),
  ],
};

/** Rentang angka panduan per skor — untuk aspek yang dinilai 0-100. */
export const RENTANG_SKOR: Record<number, string> = {
  5: '99-100',
  4: '92-98',
  3: '81-91',
  2: '76-80',
  1: '0-75',
};

/** Ambil kriteria untuk satu aspek pada skor tertentu. */
export function kriteriaAspek(kode: string, skor: number): string {
  return RUBRIK[kode]?.find((l) => l.skor === skor)?.kriteria ?? '';
}

/** Ringkasan rubrik satu aspek, terurut dari skor tertinggi. */
export function rubrikAspek(kode: string): LevelRubrik[] {
  return RUBRIK[kode] ?? [];
}
