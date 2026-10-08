import Image from 'next/image';
import type { DataLaporan } from '@/lib/sip/laporan';
import { angkaID } from '@/lib/sip/laporan';

/**
 * Lembar laporan SIP — dirender sesuai format dokumen resmi.
 * Semua nilai sudah dihitung di server; komponen ini murni tampilan.
 */
export function LembarLaporan({ data }: { data: DataLaporan }) {
  /**
   * Lebar kolom tabel A/B/C.
   *
   * Diberikan lewat <colgroup> karena dengan table-layout: fixed, lebar
   * pada <th> diabaikan browser (akibatnya semua kolom dibagi rata).
   * Versi lite memakai lebar angka yang lebih kecil supaya kolom Catatan
   * mendapat ruang paling luas untuk catatan atasan yang panjang.
   */
  const padat = data.versi === 'lite';
  const kolomLebar = padat
    ? { no: '16px', aspek: '21%', angka: '28px', skor: '38px', bobot: '30px', nilai: '30px' }
    : { no: '28px', aspek: '30%', angka: '42px', skor: '48px', bobot: '42px', nilai: '42px' };
  return (
    <div
      className={`sip-laporan bg-white mx-auto${data.versi === 'lite' ? ' sip-padat' : ''}`}
      style={{ maxWidth: '210mm' }}
    >
      {/* ============ KOP ============ */}
      <div className="sip-kop">
        <div>
          <div className="sip-kop-judul">
            SISTEM INFORMASI PENILAIAN (SIP)
            <br />
            PETUGAS FRONTLINER
          </div>
          <div className="sip-kop-sub">
            PT Bank Tabungan Negara (Persero) Tbk &middot; Cabang {data.kodeCabang}{' '}
            {data.cabang}
          </div>
        </div>
        <Image
          src="/btn-logo.png"
          alt="Bank BTN"
          height={40}
          width={64}
          className="object-contain"
        />
      </div>

      {/* ============ IDENTITAS KARYAWAN ============ */}
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#00276b',
          background: '#eef4fb',
          border: '1px solid #cbd5e1',
          borderBottom: 'none',
          padding: '5px 8px',
          letterSpacing: '0.03em',
        }}
      >
        IDENTITAS KARYAWAN
      </div>
      <div className="sip-identitas">
        <table style={{ width: '100%', fontSize: '10.5px' }}>
          <tbody>
            <BarisIdentitas label="Nama" nilai={data.nama} tebal />
            <BarisIdentitas label="NIP" nilai={data.nip} />
            <BarisIdentitas
              label="Jabatan / Posisi"
              nilai={`${data.jabatan}${data.jabatanEn && data.jabatanEn !== data.jabatan ? ` / ${data.jabatanEn}` : ''}`}
            />
            <BarisIdentitas label="Cabang" nilai={`${data.kodeCabang} — ${data.cabang}`} />
            <BarisIdentitas label="Periode Penilaian" nilai={data.periode} />
          </tbody>
        </table>

        <div className="sip-foto">
          {data.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.fotoUrl}
              alt={data.nama}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span>FOTO 3&times;4</span>
          )}
        </div>
        {data.fotoCatatan && (
          <div className="sip-foto-keterangan">{data.fotoCatatan}</div>
        )}
      </div>

      {/* ============ A / B / C ============ */}
      {data.blok.map((blok) => (
        <table className="sip-tabel" key={blok.kode}>
          <caption>
            {blok.kode}. {blok.judul} ({blok.judulEn}) &mdash; {blok.bobotKategori}
          </caption>
          <thead>
            <tr>
              <th style={{ width: kolomLebar.no }}>No</th>
              <th style={{ width: kolomLebar.aspek }}>Aspek</th>
              <th style={{ width: kolomLebar.angka }}>Angka</th>
              <th style={{ width: kolomLebar.skor, whiteSpace: 'nowrap' }}>Skor 1&ndash;5</th>
              <th style={{ width: kolomLebar.bobot }}>Bobot</th>
              <th style={{ width: kolomLebar.nilai }}>Nilai</th>
              {/* Catatan tanpa lebar -> menyerap sisa ruang tabel */}
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {blok.baris.map((b) => (
              <tr key={b.nomor}>
                <td className="sip-tengah">{b.nomor}</td>
                <td>{b.aspek}</td>
                <td className="sip-tengah sip-nowrap">{b.angka}</td>
                <td className="sip-tengah sip-nowrap">{b.skor}</td>
                <td className="sip-tengah">{b.bobot}</td>
                <td className="sip-kanan sip-nowrap">{angkaID(b.nilai)}</td>
                <td style={{ fontSize: '8.5px' }}>
                  {b.kriteria && (
                    <div style={{ color: '#475569', marginBottom: b.catatan ? '3px' : 0 }}>
                      <span style={{ fontWeight: 600, color: '#64748b' }}>
                        Dasar penilaian:{' '}
                      </span>
                      {b.kriteria}
                    </div>
                  )}
                  {b.catatan && (
                    <div style={{ color: '#0f172a' }}>{b.catatan}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="sip-kanan">
                TOTAL {blok.judul}
              </td>
              <td className="sip-kanan sip-nowrap">{angkaID(blok.total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      ))}

      {/* ============ D. TOTAL PENILAIAN ============ */}
      <table className="sip-tabel">
        <caption>D. TOTAL PENILAIAN</caption>
        <thead>
          <tr>
            <th style={{ width: '28px' }}>No</th>
            <th>Aspek</th>
            <th style={{ width: '70px' }}>Total Nilai</th>
            <th style={{ width: '52px' }}>Bobot</th>
            <th style={{ width: '70px' }}>Nilai Akhir</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="sip-tengah">1</td>
            <td>Nilai Penampilan</td>
            <td className="sip-kanan sip-nowrap">{angkaID(data.nilaiPenampilan)}</td>
            <td className="sip-tengah">20%</td>
            <td className="sip-kanan sip-nowrap">
              {angkaID(data.nilaiPenampilan * 0.2)}
            </td>
          </tr>
          <tr>
            <td className="sip-tengah">2</td>
            <td>Nilai Kemampuan</td>
            <td className="sip-kanan sip-nowrap">{angkaID(data.nilaiKemampuan)}</td>
            <td className="sip-tengah">50%</td>
            <td className="sip-kanan sip-nowrap">
              {angkaID(data.nilaiKemampuan * 0.5)}
            </td>
          </tr>
          <tr>
            <td className="sip-tengah">3</td>
            <td>Nilai Sikap</td>
            <td className="sip-kanan sip-nowrap">{angkaID(data.nilaiSikap)}</td>
            <td className="sip-tengah">30%</td>
            <td className="sip-kanan sip-nowrap">{angkaID(data.nilaiSikap * 0.3)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="sip-kanan">
              TOTAL NILAI AKHIR
            </td>
            <td className="sip-kanan sip-nowrap" style={{ fontSize: '12px' }}>
              {angkaID(data.nilaiAkhir)}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ============ BLOK NILAI AKHIR & KATEGORI ============ */}
      <div className="sip-total">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Nilai Akhir
            </div>
            <div className="sip-total-nilai">{angkaID(data.nilaiAkhir)}</div>
            <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '2px' }}>
              Skala 0,00 &ndash; 5,00
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Kategori Penilaian
            </div>
            <div style={{ marginTop: '3px' }}>
              <span className="sip-rating">{data.ratingDwibahasa}</span>
            </div>
            {data.band && (
              <div style={{ fontSize: '8.5px', color: '#94a3b8', marginTop: '3px' }}>
                Rentang nilai {angkaID(data.band.min)} &ndash; {angkaID(data.band.max)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============ LEMBAR KOMITMEN ============ */}
      <div className="sip-komitmen">
        <div className="sip-komitmen-judul">LEMBAR KOMITMEN</div>
        <p style={{ fontSize: '9.5px', lineHeight: 1.6, color: '#334155', margin: 0 }}>
          Dengan menandatangani lembar ini, kedua pihak menyatakan bahwa hasil
          penilaian di atas telah dibahas bersama dan disepakati sebagai dasar
          pembinaan serta pengembangan kinerja petugas pada periode berikutnya.
        </p>

        {data.catatanUmum && (
          <div className="sip-catatan" style={{ marginBottom: 0, marginTop: '8px' }}>
            {data.catatanUmum}
          </div>
        )}

        <div className="sip-ttd-grid">
          <div className="sip-ttd-box">
            <div style={{ marginBottom: '4px' }}>Tanda Tangan Pegawai</div>
            <div className="sip-ttd-ruang" />
            <div style={{ fontWeight: 600 }}>{data.nama}</div>
            <div style={{ color: '#64748b' }}>NIP {data.nip}</div>
          </div>

          <div className="sip-ttd-box">
            <div style={{ marginBottom: '4px' }}>Tanda Tangan Atasan</div>
            <div className="sip-ttd-ruang" />
            <div style={{ fontWeight: 600 }}>{data.penilai}</div>
            <div style={{ color: '#64748b' }}>NIP {data.penilaiNip}</div>
          </div>
        </div>
      </div>

      <div className="sip-footer">
        Dokumen ini dihasilkan oleh SIP &mdash; Sistem Informasi Penilaian Petugas
        Frontliner &middot; Dicetak {data.tanggalCetak} &middot; Status: {data.status}
      </div>
    </div>
  );
}

function BarisIdentitas({
  label,
  nilai,
  tebal,
}: {
  label: string;
  nilai: string;
  tebal?: boolean;
}) {
  return (
    <tr>
      <td style={{ width: '130px', padding: '2px 0', color: '#64748b' }}>{label}</td>
      <td style={{ width: '10px', padding: '2px 0', color: '#64748b' }}>:</td>
      <td style={{ padding: '2px 0', fontWeight: tebal ? 700 : 500 }}>{nilai}</td>
    </tr>
  );
}
