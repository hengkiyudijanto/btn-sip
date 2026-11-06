import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { boleh } from '@/lib/sip/akses';
import { kategoriBMI } from '@/lib/sip/kesehatan';
import { TombolPengukuranIMT } from '@/components/form-pengukuran-imt';
import { pilihPeriodeRelevan, daftarPeriodeUntukPemilih } from '@/lib/sip/periode-aktif';

export const metadata = { title: 'Indeks Massa Tubuh' };

function umur(tanggal: Date | null): number | null {
  if (!tanggal) return null;
  const kini = new Date();
  let hasil = kini.getUTCFullYear() - tanggal.getUTCFullYear();
  const ulangTahun = new Date(Date.UTC(kini.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate()));
  if (kini < ulangTahun) hasil--;
  return hasil;
}

export default async function HalamanMonitoring({ searchParams }: { searchParams: Promise<{ periode?: string; tanggal?: string }> }) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!boleh(saya.role, 'lihat_monitoring')) redirect('/dasbor');

  const { periode: periodeParam, tanggal: tanggalParam } = await searchParams;
  const periode = periodeParam
    ? (await prisma.periode.findUnique({ where: { id: periodeParam } })) ?? await pilihPeriodeRelevan()
    : await pilihPeriodeRelevan();
  if (!periode) redirect('/dasbor');
  const tanggal = tanggalParam && /^\d{4}-\d{2}-\d{2}$/.test(tanggalParam) ? new Date(`${tanggalParam}T00:00:00.000Z`) : new Date();
  const tanggalAman = tanggal < periode.tanggalMulai ? periode.tanggalMulai : tanggal > periode.tanggalSelesai ? periode.tanggalSelesai : tanggal;
  const tanggalKey = tanggalAman.toISOString().slice(0, 10);
  const daftarPeriode = await daftarPeriodeUntukPemilih();
  const daftar = await prisma.pegawai.findMany({
    where: { aktif: true, role: 'PEGAWAI', ...(saya.role === 'ADMIN' ? {} : { cabangId: saya.cabang.id }) },
    include: { cabang: { select: { kode: true, nama: true } }, jabatan: { select: { nama: true } }, pengukuranIMT: { where: { periodeId: periode.id, tanggal: tanggalAman } } },
    orderBy: [{ cabang: { kode: 'asc' } }, { nama: 'asc' }],
  });
  const bmiSemua = daftar.map((p) => p.pengukuranIMT[0]?.nilaiIMT ?? null).filter((b): b is number => b !== null);
  const ringkas = {
    total: daftar.length,
    lengkap: daftar.filter((p) => p.pengukuranIMT.length > 0).length,
    normal: bmiSemua.filter((bmi) => kategoriBMI(bmi) === 'Normal').length,
  };

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl font-semibold text-abu-900">Indeks Massa Tubuh</h1>
        <p className="mt-1 text-sm text-abu-500">{periode.nama} · pengukuran tanggal {tanggalKey}.</p>
        <div className="mt-6 kartu p-4 flex flex-wrap items-end gap-4"><form className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-abu-600">Periode<select name="periode" defaultValue={periode.id} className="mt-1 block rounded-lg border border-abu-300 px-3 py-2 text-sm">{daftarPeriode.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></label>
          <label className="text-xs text-abu-600">Tanggal pengukuran<input name="tanggal" type="date" min={periode.tanggalMulai.toISOString().slice(0, 10)} max={periode.tanggalSelesai.toISOString().slice(0, 10)} defaultValue={tanggalKey} className="mt-1 block rounded-lg border border-abu-300 px-3 py-2 text-sm" /></label>
          <button className="rounded-lg bg-btn-biru-600 px-4 py-2 text-sm font-semibold text-white">Tampilkan</button>
        </form></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="kartu p-4"><p className="text-xs text-abu-500">Total pegawai</p><p className="mt-1 text-2xl font-semibold text-abu-900">{ringkas.total}</p></div>
          <div className="kartu p-4"><p className="text-xs text-abu-500">Data fisik lengkap</p><p className="mt-1 text-2xl font-semibold text-abu-900">{ringkas.lengkap}</p></div>
          <div className="kartu p-4"><p className="text-xs text-abu-500">BMI kategori normal</p><p className="mt-1 text-2xl font-semibold text-sukses">{ringkas.normal}</p></div>
        </div>
        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto"><table className="tabel-sip">
            <thead><tr><th>NIP</th><th>Nama</th><th>Cabang</th><th>Jabatan</th><th>Tinggi</th><th>Berat</th><th>IMT</th><th>Kategori</th>{saya.role === 'SUPERVISOR' && <th>Aksi</th>}</tr></thead>
            <tbody>{daftar.map((p) => {
              const data = p.pengukuranIMT[0];
              return <tr key={p.id}><td className="text-xs tabular-nums">{p.nip}</td><td className="font-medium">{p.nama}</td><td className="text-xs">{p.cabang.kode} — {p.cabang.nama}</td><td className="text-xs">{p.jabatan?.nama ?? '—'}</td><td className="text-xs">{data?.tinggiBadan ?? '—'} cm</td><td className="text-xs">{data?.beratBadan ?? '—'} kg</td><td className="text-xs font-semibold">{data?.nilaiIMT ?? '—'}</td><td className="text-xs">{data?.kategori ?? 'Belum diukur'}</td>{saya.role === 'SUPERVISOR' && <td><TombolPengukuranIMT pegawaiId={p.id} periodeId={periode.id} tanggal={tanggalKey} beratBadan={data?.beratBadan ?? null} tinggiBadan={data?.tinggiBadan ?? p.tinggiBadan} lingkarPinggang={data?.lingkarPinggang ?? null} /></td>}</tr>;
            })}</tbody>
          </table></div>
          {daftar.length === 0 && <p className="p-6 text-center text-sm text-abu-400">Belum ada pegawai dengan peran PEGAWAI.</p>}
        </div>
        <p className="mt-3 text-xs text-abu-400">BMI hanya indikator umum, bukan diagnosis medis. Data kesehatan medis tidak disimpan di menu ini.</p>
      </div>
    </Kerangka>
  );
}
