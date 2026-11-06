import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { susunRekapIMT, tahunRekapIMT } from '@/lib/sip/imt-rekap';

export const metadata = { title: 'Rekap IMT' };

export default async function HalamanRekapIMT({ searchParams }: { searchParams: Promise<{ tahun?: string }> }) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');
  const tahunTersedia = await tahunRekapIMT();
  const tahunDefault = tahunTersedia[0] ?? new Date().getFullYear();
  const sp = await searchParams;
  const tahun = Number(sp.tahun) || tahunDefault;
  const rekap = await susunRekapIMT({ tahun });

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-abu-900">Rekapitulasi Indeks Massa Tubuh</h1>
            <p className="mt-2 text-sm text-abu-500">Berat badan terakhir setiap pegawai pada tiap periode mingguan.</p>
          </div>
          <form className="flex items-end gap-2" method="get">
            <label className="text-xs text-abu-600">Tahun<select name="tahun" defaultValue={tahun} className="mt-1 block rounded-lg border border-abu-300 px-3 py-2 text-sm">{tahunTersedia.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <button className="rounded-lg border border-abu-300 px-4 py-2 text-xs font-semibold text-abu-700 hover:bg-abu-50">Tampilkan</button>
          </form>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <form action="/laporan/imt/pptx" method="get"><input type="hidden" name="tahun" value={tahun} /><button className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white hover:bg-btn-biru-700">Unduh Rekap PPTX Landscape</button></form>
          <span className="text-xs text-abu-500">{rekap.filter((p) => p.baris.length > 0).length} periode memiliki data IMT</span>
        </div>
        <div className="mt-5 rounded-lg bg-abu-50 p-4 text-xs text-abu-600">Jika ada beberapa pengukuran dalam satu pekan, yang ditampilkan adalah pengukuran terakhir pada pekan tersebut.</div>
        <div className="mt-6 space-y-5">
          {rekap.map((periode) => (
            <section key={`${periode.periode}-${periode.mulai.toISOString()}`} className="kartu overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-abu-200 bg-abu-50 px-4 py-3"><div><h2 className="text-sm font-semibold text-abu-900">{periode.periode}</h2><p className="mt-0.5 text-xs text-abu-500">{periode.baris.length} pegawai terukur</p></div><span className="text-xs text-abu-500">{periode.unit}</span></div>
              {periode.baris.length === 0 ? <p className="px-4 py-5 text-sm text-abu-400">Belum ada data IMT pada periode ini.</p> : <div className="overflow-x-auto"><table className="tabel-sip"><thead><tr><th>No</th><th>NIP</th><th>Nama</th><th>Jabatan</th><th>Berat (kg)</th><th>IMT</th><th>Kategori</th></tr></thead><tbody>{periode.baris.map((b, i) => <tr key={b.nip}><td className="text-xs text-center">{i + 1}</td><td className="text-xs tabular-nums">{b.nip}</td><td className="text-sm font-medium">{b.nama}</td><td className="text-xs">{b.jabatan}</td><td className="text-xs text-center">{b.berat?.toFixed(1).replace('.', ',') ?? '—'}</td><td className="text-xs text-center font-semibold">{b.imt?.toFixed(1).replace('.', ',') ?? '—'}</td><td className="text-xs">{b.kategori ?? 'Belum diukur'}</td></tr>)}</tbody></table></div>}
            </section>
          ))}
          {rekap.length === 0 && <div className="kartu p-8 text-center text-sm text-abu-400">Belum ada periode pada tahun {tahun}.</div>}
        </div>
      </div>
    </Kerangka>
  );
}
