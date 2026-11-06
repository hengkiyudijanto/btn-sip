import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { boleh } from '@/lib/sip/akses';
import { hitungBMI, kategoriBMI } from '@/lib/sip/kesehatan';
import { simpanBeratBadan } from '@/app/actions/pegawai';

export const metadata = { title: 'Monitoring' };

function umur(tanggal: Date | null): number | null {
  if (!tanggal) return null;
  const kini = new Date();
  let hasil = kini.getUTCFullYear() - tanggal.getUTCFullYear();
  const ulangTahun = new Date(Date.UTC(kini.getUTCFullYear(), tanggal.getUTCMonth(), tanggal.getUTCDate()));
  if (kini < ulangTahun) hasil--;
  return hasil;
}

export default async function HalamanMonitoring() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!boleh(saya.role, 'lihat_monitoring')) redirect('/dasbor');

  const daftar = await prisma.pegawai.findMany({
    where: { role: 'PEGAWAI', ...(boleh(saya.role, 'lihat_semua_cabang') ? {} : { cabangId: saya.cabang.id }) },
    include: { cabang: { select: { kode: true, nama: true } }, jabatan: { select: { nama: true } } },
    orderBy: [{ cabang: { kode: 'asc' } }, { nama: 'asc' }],
  });
  const bmiSemua = daftar.map((p) => hitungBMI(p.beratBadan, p.tinggiBadan)).filter((b): b is number => b !== null);
  const ringkas = {
    total: daftar.length,
    lengkap: daftar.filter((p) => p.tanggalLahir && p.tinggiBadan && p.beratBadan).length,
    normal: bmiSemua.filter((bmi) => kategoriBMI(bmi) === 'Normal').length,
  };

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl font-semibold text-abu-900">Monitoring Pegawai</h1>
        <p className="mt-1 text-sm text-abu-500">Indikator kebugaran nonmedis berdasarkan data fisik pegawai.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="kartu p-4"><p className="text-xs text-abu-500">Total pegawai</p><p className="mt-1 text-2xl font-semibold text-abu-900">{ringkas.total}</p></div>
          <div className="kartu p-4"><p className="text-xs text-abu-500">Data fisik lengkap</p><p className="mt-1 text-2xl font-semibold text-abu-900">{ringkas.lengkap}</p></div>
          <div className="kartu p-4"><p className="text-xs text-abu-500">BMI kategori normal</p><p className="mt-1 text-2xl font-semibold text-sukses">{ringkas.normal}</p></div>
        </div>
        <div className="mt-6 kartu overflow-hidden">
          <div className="overflow-x-auto"><table className="tabel-sip">
            <thead><tr><th>NIP</th><th>Nama</th><th>Cabang</th><th>Jabatan</th><th>Usia</th><th>Tinggi</th><th>Berat</th><th>BMI</th><th>Status</th>{saya.role === 'ADMIN' && <th>Aksi</th>}</tr></thead>
            <tbody>{daftar.map((p) => {
              const bmi = hitungBMI(p.beratBadan, p.tinggiBadan);
              const status = bmi === null ? 'Data belum lengkap' : kategoriBMI(bmi);
              return <tr key={p.id}><td className="text-xs tabular-nums">{p.nip}</td><td className="font-medium">{p.nama}</td><td className="text-xs">{p.cabang.kode} — {p.cabang.nama}</td><td className="text-xs">{p.jabatan?.nama ?? '—'}</td><td className="text-xs">{umur(p.tanggalLahir) ?? '—'}</td><td className="text-xs">{p.tinggiBadan ? `${p.tinggiBadan} cm` : '—'}</td><td className="text-xs">{p.beratBadan ? `${p.beratBadan} kg` : '—'}</td><td className="text-xs font-semibold">{bmi ?? '—'}</td><td><span className="rounded-full bg-abu-100 px-2 py-1 text-[11px]">{status}</span></td>{saya.role === 'ADMIN' && <td><form action={simpanBeratBadan} className="flex items-center gap-1"><input type="hidden" name="pegawaiId" value={p.id} /><input name="beratBadan" type="number" min="1" step="0.1" defaultValue={p.beratBadan ?? ''} placeholder="kg" className="w-20 rounded border border-abu-300 px-2 py-1 text-xs" /><button className="rounded bg-btn-biru-600 px-2 py-1 text-xs text-white">Simpan</button></form></td>}</tr>;
            })}</tbody>
          </table></div>
          {daftar.length === 0 && <p className="p-6 text-center text-sm text-abu-400">Belum ada pegawai dengan peran PEGAWAI.</p>}
        </div>
        <p className="mt-3 text-xs text-abu-400">BMI hanya indikator umum, bukan diagnosis medis. Data kesehatan medis tidak disimpan di menu ini.</p>
      </div>
    </Kerangka>
  );
}
