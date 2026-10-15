/**
 * Tampilan ranking SATU HALAMAN — dibuka lewat tombol "Tampilkan 1 Halaman"
 * di halaman /laporan/ranking.
 *
 * Berbeda dari halaman ranking biasa yang mengelompokkan per unit+posisi,
 * halaman ini menampilkan SEMUA petugas dalam satu peringkat berurutan dari
 * nilai tertinggi, dirancang supaya muat satu halaman A4 (bisa dicetak/disimpan
 * jadi PDF) dan bisa diunduh sebagai PPTX.
 *
 * `?cetak=1` menyembunyikan bilah tombol supaya berkas PDF-nya bersih.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { susunRankingGabungan } from '@/lib/sip/ranking-gabungan';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { kapitalkan } from '@/lib/sip/teks';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';
import type { JenisCabang } from '@prisma/client';
import './lembar.css';

export const metadata = { title: 'Ranking Satu Halaman' };

/**
 * Tinggi baris dihitung supaya SELURUH peserta pasti muat satu halaman A4.
 *
 * Pendekatan ambang tetap (<=24 baku, 25-34 agak rapat, dst) TERBUKTI SALAH
 * saat diukur di peramban: dengan foto setinggi 10,7mm, satu baris baku makan
 * 13,6mm, sedangkan ruang tersisa setelah kop+tabel kepala+footer+padding
 * hanya 218,6mm — jadi hanya 16 baris yang muat, bukan 24. Halaman yang
 * mengaku "1 halaman" tapi meluber ke halaman kedua justru lebih buruk daripada
 * tulisan yang kecil.
 *
 * Karena itu tinggi baris dihitung dari sisa ruang: makin banyak peserta, makin
 * tinggi barisnya dikecilkan. Angka di bawah adalah hasil pengukuran nyata di
 * peramban (mm), bukan perkiraan.
 */

/** Tinggi tetap yang tidak ikut jumlah baris: kop + kepala tabel + footer + margin + padding. */
const BIAYA_TETAP_MM = 78.4;

/** Ruang yang boleh dipakai baris tabel pada A4 (297mm). */
const RUANG_BARIS_MM = 297 - BIAYA_TETAP_MM;

/**
 * Tinggi baris minimum supaya foto 3:4 masih pantas ditampilkan.
 */
const TINGGI_BARIS_MIN_FOTO_MM = 9.4;

/**
 * Tinggi minimum satu baris (mm) supaya masih terbaca. Di bawah ini tulisan
 * sudah terlalu kecil untuk lembar resmi.
 */
const TINGGI_BARIS_MIN_MM = 6.2;

/** Batas atas tinggi baris: di atas ini baris tidak perlu lebih tinggi lagi. */
const TINGGI_BARIS_MAKS_MM = 13.6;

/**
 * Jumlah peserta yang masih bisa dimuat satu halaman.
 *
 * Batasnya: tinggi baris minimum yang masih terbaca adalah 6,2mm, dan ruang
 * yang tersedia 218,6mm — jadi sekitar 35 baris adalah batas mutlak. Di atas
 * itu tidak ada cara jujur untuk memuat semuanya dalam satu halaman tanpa
 * mengecilkan tulisan sampai tidak terbaca, jadi halaman MEMBERI TAHU bahwa
 * daftarnya dipotong, bukan diam-diam meluber ke halaman kedua.
 *
 * Perilaku ini disengaja: pengguna meminta "semua tampil di 1 halaman", dan
 * untuk jumlah di atas batas itu permintaan tersebut tidak bisa dipenuhi
 * dengan jujur — jadi yang ditampilkan adalah peringkat TERATAS sebanyak yang
 * muat, dengan keterangan jelas berapa yang ditampilkan dari berapa total.
 */
const MAKS_BARIS_SATU_HALAMAN = 35;

/**
 * Tentukan ukuran baris dan apakah foto ditampilkan.
 *
 * Urutan prioritas: (1) semua peserta muat satu halaman, (2) teks tetap
 * terbaca, (3) foto baru dilepas kalau memang tidak ada ruang tersisa.
 */
function aturBaris(jumlah: number): {
  tinggiBaris: number;
  pakaiFoto: boolean;
  tampil: number;
  dipotong: boolean;
} {
  const tampil = Math.min(jumlah, MAKS_BARIS_SATU_HALAMAN);
  const dipotong = jumlah > MAKS_BARIS_SATU_HALAMAN;
  // catatan "daftar dipotong" ikut memakan ruang (± 9mm) — dikurangi dari
  // ruang baris supaya tabelnya tidak meluber ke halaman kedua
  const ruang = dipotong ? RUANG_BARIS_MM - 9 : RUANG_BARIS_MM;
  const perBaris = ruang / Math.max(1, tampil);

  if (perBaris >= TINGGI_BARIS_MIN_FOTO_MM) {
    return {
      tinggiBaris: Math.min(TINGGI_BARIS_MAKS_MM, perBaris),
      pakaiFoto: true,
      tampil,
      dipotong,
    };
  }

  return {
    tinggiBaris: Math.max(TINGGI_BARIS_MIN_MM, Math.min(TINGGI_BARIS_MAKS_MM, perBaris)),
    pakaiFoto: false,
    tampil,
    dipotong,
  };
}

export default async function HalamanRankingSatu({
  searchParams,
}: {
  searchParams: Promise<{
    periode?: string;
    jenis?: string;
    cabang?: string;
    posisi?: string;
    cetak?: string;
  }>;
}) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');

  const sp = await searchParams;
  const modeCetak = sp.cetak === '1';

  if (!sp.periode) {
    const relevan = await pilihPeriodeRelevan();
    if (relevan) {
      const q = new URLSearchParams();
      q.set('periode', relevan.id);
      if (sp.jenis) q.set('jenis', sp.jenis);
      if (sp.cabang) q.set('cabang', sp.cabang);
      if (sp.posisi) q.set('posisi', sp.posisi);
      if (modeCetak) q.set('cetak', '1');
      redirect(`/laporan/ranking/satu?${q.toString()}`);
    }
  }

  const hasil = sp.periode
    ? await susunRankingGabungan({
        periodeId: sp.periode,
        jenis: (sp.jenis as JenisCabang | undefined) || null,
        kodeCabang: sp.cabang || null,
        kodeJabatan: sp.posisi || null,
      })
    : null;

  // parameter unduhan — dibawa apa adanya
  const kueri = new URLSearchParams();
  if (sp.periode) kueri.set('periode', sp.periode);
  if (sp.jenis) kueri.set('jenis', sp.jenis);
  if (sp.cabang) kueri.set('cabang', sp.cabang);
  if (sp.posisi) kueri.set('posisi', sp.posisi);

  const kueriCetak = new URLSearchParams(kueri);
  kueriCetak.set('cetak', '1');

  // tata letak lembar: tinggi baris + apakah foto muat + apakah daftar dipotong
  const tata = aturBaris(hasil?.jumlahPeserta ?? 0);
  const barisTampil = hasil ? hasil.baris.slice(0, tata.tampil) : [];

  return (
    <div className="min-h-screen bg-abu-100 print:bg-white">
      {/* ===== bilah tombol (hilang saat dicetak) ===== */}
      {!modeCetak && (
        <div className="sticky top-0 z-10 border-b border-abu-200 bg-white/95 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3 px-4 py-3">
            <Link
              href={`/laporan/ranking?${kueri.toString()}`}
              className="text-xs font-medium text-abu-600 hover:text-abu-900"
            >
              ← Kembali
            </Link>

            <span className="text-xs text-abu-400">
              {hasil ? `${hasil.jumlahPeserta} petugas · ${hasil.periode}` : 'Tidak ada data'}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <a
                href={`/laporan/ranking/satu/pptx?${kueri.toString()}`}
                className="inline-flex items-center gap-2 rounded-lg border border-btn-biru-600 px-3 py-2 text-xs font-semibold text-btn-biru-700 hover:bg-btn-biru-50 transition-colors"
              >
                ⬇ PPTX
              </a>
              <a
                href={`/laporan/ranking/satu?${kueriCetak.toString()}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-lg bg-btn-biru-600 px-3 py-2 text-xs font-semibold text-white hover:bg-btn-biru-700 transition-colors"
              >
                ⬇ PDF / Cetak
              </a>
            </div>
          </div>
          <p className="mx-auto max-w-[210mm] px-4 pb-2 text-[11px] text-abu-400 print:hidden">
            Untuk PDF: pilih &quot;Simpan sebagai PDF&quot; dan pastikan kertas
            <strong> A4</strong>, margin <strong>Default</strong>, serta
            &quot;Headers and footers&quot; <strong>dimatikan</strong>.
          </p>
        </div>
      )}

      {/* ===== lembar A4 ===== */}
      <div className="mx-auto max-w-[210mm] px-4 py-6 print:p-0 print:max-w-none">
        {!hasil && (
          <div className="kartu p-8 text-center text-sm text-abu-400">
            Belum ada periode yang punya penilaian.
          </div>
        )}

        {hasil && hasil.jumlahPeserta === 0 && (
          <div className="kartu p-8 text-center text-sm text-abu-600">
            Tidak ada penilaian yang cocok dengan filter ini.
          </div>
        )}

        {hasil && hasil.jumlahPeserta > 0 && (
          <div
            className="lembar-a4"
            style={{
              ['--tinggi-baris' as string]: `${tata.tinggiBaris}mm`,
            }}
          >
            {/* ---- kop ---- */}
            <div className="lembar-kop">
              <div className="lembar-kop-kiri">
                <div className="lembar-kop-instansi">PT Bank Tabungan Negara (Persero) Tbk</div>
                <div className="lembar-kop-judul">LAPORAN RANKING PETUGAS FRONTLINER</div>
                <div className="lembar-kop-sub">
                  {hasil.periode} &nbsp;·&nbsp; {hasil.unit} &nbsp;·&nbsp; {hasil.posisi}
                </div>
              </div>
              <div className="lembar-kop-kanan">
                <div className="lembar-kop-badge">
                  {hasil.jumlahPeserta}
                  <span>peserta</span>
                </div>
              </div>
            </div>

            {/* ---- tabel satu peringkat ---- */}
            <table className="lembar-tabel">
              <colgroup>
                <col style={{ width: '7%' }} />
                {tata.pakaiFoto && <col style={{ width: '9%' }} />}
                <col style={{ width: '27%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="ta-c">Peringkat</th>
                  {tata.pakaiFoto && <th className="ta-c">Foto</th>}
                  <th>Nama Petugas</th>
                  <th>Jabatan</th>
                  <th>Unit</th>
                  <th className="ta-c">Nilai</th>
                  <th className="ta-c">Kategori</th>
                </tr>
              </thead>
              <tbody>
                {barisTampil.map((b) => (
                  <tr key={b.nip} className={b.peringkat <= 3 ? `baris-top${b.peringkat}` : ''}>
                    <td className="ta-c lembar-peringkat">{b.peringkat}</td>
                    {tata.pakaiFoto && (
                      <td className="ta-c">
                        {b.foto ? (
                          // data URL sudah tersedia dari server; tidak perlu permintaan
                          // jaringan tambahan sehingga cetak tidak menunggu gambar
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.foto} alt="" className="lembar-foto" />
                        ) : (
                          <span className="lembar-foto lembar-foto-kosong" />
                        )}
                      </td>
                    )}
                    <td className="lembar-nama">{kapitalkan(b.nama)}</td>
                    <td className="lembar-kecil">{b.jabatan}</td>
                    <td className="lembar-kecil">{b.unit}</td>
                    <td className="ta-c lembar-nilai">{b.nilai.toFixed(2).replace('.', ',')}</td>
                    <td className="ta-c">
                      <span className={`lembar-pil pil-${b.kategori.toLowerCase().replace(/\s+/g, '-')}`}>
                        {b.kategori}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Kalau pesertanya melebihi batas satu halaman, katakan dengan
                jujur berapa yang ditampilkan — jangan diam-diam meluber ke
                halaman kedua atau memotong tanpa penjelasan. */}
            {tata.dipotong && (
              <p className="lembar-catatan">
                Menampilkan <strong>{tata.tampil} peringkat teratas</strong> dari
                total <strong>{hasil.jumlahPeserta} peserta</strong> pada periode ini.
                Sisanya tidak dimuat karena melebihi kapasitas satu halaman —
                persempit filter (unit atau posisi) untuk melihat peringkat berikutnya.
              </p>
            )}

            {/* ---- footer: legenda + tanda tangan ---- */}
            <div className="lembar-bawah">
              <div className="lembar-legenda">
                <span className="lembar-legenda-judul">Kategori</span>
                {[
                  ['Istimewa', '≥ 4,80'],
                  ['Sangat Baik', '4,60–4,79'],
                  ['Baik', '4,00–4,59'],
                  ['Cukup', '3,60–3,99'],
                  ['Kurang', '< 3,60'],
                ].map(([nama, rentang]) => (
                  <span key={nama} className="lembar-legenda-item">
                    <span className={`lembar-legenda-titik pil-${nama.toLowerCase().replace(/\s+/g, '-')}`} />
                    {nama} <em>{rentang}</em>
                  </span>
                ))}
              </div>
              <div className="lembar-ttd">
                <div className="lembar-ttd-kota">Dicetak dari SIP · {hasil.periode}</div>
                <div className="lembar-ttd-ruang" />
                <div className="lembar-ttd-nama">Petugas Penilai</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
