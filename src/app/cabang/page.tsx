import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { FormTambahCabang, AksiCabang } from '@/components/kelola-cabang';
import { susunPohon, LABEL_JENIS, WARNA_JENIS, type CabangRingkas } from '@/lib/sip/hierarki';

export const metadata = { title: 'Cabang' };

export default async function HalamanCabang() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (saya.role !== 'ADMIN') redirect('/dasbor');

  const semua = await prisma.cabang.findMany({
    orderBy: { kode: 'asc' },
    include: { _count: { select: { pegawai: true, turunan: true } } },
  });

  // susun berjenjang supaya hierarki terlihat jelas
  const ringkas: CabangRingkas[] = semua.map((c) => ({
    id: c.id,
    kode: c.kode,
    nama: c.nama,
    jenis: c.jenis,
    indukId: c.indukId,
    aktif: c.aktif,
  }));
  const pohon = susunPohon(ringkas);

  const daftarKanwil = semua
    .filter((c) => c.jenis === 'KANWIL')
    .map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis }));
  const daftarKc = semua
    .filter((c) => c.jenis === 'KC')
    .map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis }));

  const totalPegawai = semua.reduce((a, c) => a + c._count.pegawai, 0);
  const hitung = (j: string) => semua.filter((c) => c.jenis === j).length;

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Pengelolaan Cabang</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500">
            {semua.length} unit &middot; {hitung('KANWIL')} Kanwil &middot; {hitung('KC')} KC &middot;{' '}
            {hitung('KCP')} KCP &middot; {totalPegawai} pegawai
          </p>
        </div>

        <div className="mt-6">
          <FormTambahCabang daftarKanwil={daftarKanwil} daftarKc={daftarKc} />
        </div>

        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>Unit kerja</th>
                  <th>Jenis</th>
                  <th>Cabang induk</th>
                  <th className="text-right">Turunan</th>
                  <th className="text-right">Pegawai</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {pohon.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-sm text-abu-400">
                      Belum ada cabang. Mulai dengan membuat Kanwil.
                    </td>
                  </tr>
                )}
                {pohon.map((c) => {
                  const asli = semua.find((x) => x.id === c.id)!;
                  const induk = semua.find((x) => x.id === asli.indukId);
                  return (
                    <tr key={c.id}>
                      <td>
                        {/* indentasi menunjukkan kedalaman hierarki */}
                        <div
                          style={{ paddingLeft: `${c.kedalaman * 22}px` }}
                          className="flex items-center gap-2"
                        >
                          {c.kedalaman > 0 && (
                            <span className="text-abu-300 select-none shrink-0" aria-hidden>
                              └─
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-semibold tabular-nums text-abu-700">
                              {c.kode}
                            </div>
                            <div className="font-medium text-abu-900 truncate">{c.nama}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                            WARNA_JENIS[c.jenis] ?? 'bg-abu-100 text-abu-600'
                          }`}
                        >
                          {LABEL_JENIS[c.jenis] ?? c.jenis}
                        </span>
                      </td>
                      <td className="text-xs text-abu-600">
                        {induk ? `${induk.kode} — ${induk.nama}` : '—'}
                      </td>
                      <td className="text-right tabular-nums text-sm text-abu-700">
                        {c.jumlahTurunan > 0 ? c.jumlahTurunan : '—'}
                      </td>
                      <td className="text-right tabular-nums text-sm text-abu-700">
                        {asli._count.pegawai}
                      </td>
                      <td>
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                            c.aktif ? 'bg-sukses-bg text-sukses' : 'bg-abu-100 text-abu-500'
                          }`}
                        >
                          {c.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="text-right">
                        <AksiCabang
                          id={c.id}
                          kode={c.kode}
                          nama={c.nama}
                          jenis={c.jenis}
                          alamat={asli.alamat}
                          indukId={asli.indukId}
                          aktif={c.aktif}
                          jumlahPegawai={asli._count.pegawai}
                          jumlahTurunan={asli._count.turunan}
                          daftarKanwil={daftarKanwil}
                          daftarKc={daftarKc}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 kartu p-6">
          <h3 className="text-sm font-semibold text-abu-800">Struktur &amp; aturan</h3>
          <ul className="mt-3 space-y-2 text-sm text-abu-500 leading-relaxed">
            <li>
              &middot; Hierarki: <strong>Kanwil</strong> &rarr; <strong>KC</strong> &rarr;{' '}
              <strong>KCP</strong>. Induk dari KC harus Kanwil; induk dari KCP harus KC.
            </li>
            <li>
              &middot; Saat Kanwil membuat laporan, <strong>seluruh cabang turunannya</strong> (KC
              dan KCP di bawahnya) otomatis ikut terhitung. KC mencakup KCP di bawahnya.
            </li>
            <li>
              &middot; Cabang yang masih punya turunan atau pegawai{' '}
              <strong>tidak dapat dihapus</strong>.
            </li>
            <li>
              &middot; Kode cabang tidak dapat diubah setelah dibuat agar data historis tetap
              konsisten. Nama dan induk tetap bisa dipindahkan.
            </li>
          </ul>
        </div>
      </div>
    </Kerangka>
  );
}
