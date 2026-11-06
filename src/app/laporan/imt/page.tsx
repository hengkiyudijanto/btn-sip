import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Kerangka } from '@/components/kerangka';
import { bolehBukaHalaman, boleh } from '@/lib/sip/akses';
import { susunRekapIMT } from '@/lib/sip/imt-rekap';
import { kumpulkanTurunan, susunPohon, LABEL_JENIS, type CabangRingkas } from '@/lib/sip/hierarki';
import { pilihPeriodeRelevan, daftarPeriodeUntukPemilih } from '@/lib/sip/periode-aktif';

export const metadata = { title: 'Laporan Rekap IMT' };

export default async function HalamanRekapIMT({ searchParams }: { searchParams: Promise<{ periode?: string; cabang?: string }> }) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');
  const sp = await searchParams;
  const daftarPeriode = await daftarPeriodeUntukPemilih();
  const periode = sp.periode ? (daftarPeriode.find((p) => p.id === sp.periode) ?? await pilihPeriodeRelevan()) : await pilihPeriodeRelevan();
  const semuaCabang = await prisma.cabang.findMany({ orderBy: { kode: 'asc' } });
  const bolehSemua = boleh(saya.role, 'lihat_semua_cabang');
  const cabangPilihan = bolehSemua ? semuaCabang.filter((c) => c.aktif) : [];
  const unit = sp.cabang ? semuaCabang.find((c) => c.id === sp.cabang) : null;
  const ringkasCabang: CabangRingkas[] = semuaCabang.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis, indukId: c.indukId, aktif: c.aktif }));
  const cabangIds = unit ? kumpulkanTurunan(unit.id, ringkasCabang) : bolehSemua ? null : [saya.cabang.id];
  const rekap = periode ? await susunRekapIMT({ periodeId: periode.id, cabangIds }) : [];

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div><h1 className="text-2xl font-bold text-abu-900">Rekapitulasi Indeks Massa Tubuh</h1><p className="mt-2 text-sm text-abu-500">Filter mengikuti Rekap SIP: periode dan unit kerja.</p></div>
        <form className="mt-6 kartu p-5" method="get"><div className={`grid gap-4 ${bolehSemua && cabangPilihan.length ? 'sm:grid-cols-2' : ''}`}>
          <label className="text-xs text-abu-600">Periode<select name="periode" defaultValue={periode?.id ?? ''} className="mt-1 block w-full rounded-lg border border-abu-300 px-3 py-2 text-sm">{daftarPeriode.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></label>
          {bolehSemua && cabangPilihan.length > 0 && <label className="text-xs text-abu-600">Unit kerja<select name="cabang" defaultValue={unit?.id ?? ''} className="mt-1 block w-full rounded-lg border border-abu-300 px-3 py-2 text-sm"><option value="">Semua unit</option>{susunPohon(cabangPilihan.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis, indukId: c.indukId, aktif: c.aktif }))).map((c) => <option key={c.id} value={c.id}>{' '.repeat(c.kedalaman * 3)}{LABEL_JENIS[c.jenis]} {c.kode} — {c.nama}</option>)}</select></label>}
        </div><button className="mt-4 rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white">Tampilkan</button></form>
        <div className="mt-4 flex flex-wrap items-center gap-3">{periode && <form action="/laporan/imt/pptx" method="get"><input type="hidden" name="periode" value={periode.id} />{unit && <input type="hidden" name="cabang" value={unit.id} />}<button className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white">Unduh Rekap PPTX Landscape</button></form>}<span className="text-xs text-abu-500">{unit ? `Cakupan: ${unit.nama} beserta turunannya` : 'Cakupan: semua unit yang berwenang'}</span></div>
        <div className="mt-6 space-y-5">{rekap.map((p) => <section key={p.periode} className="kartu overflow-hidden"><div className="border-b border-abu-200 bg-abu-50 px-4 py-3"><h2 className="text-sm font-semibold text-abu-900">{p.periode}</h2><p className="text-xs text-abu-500">{p.baris.length} pegawai terukur · {p.unit}</p></div>{p.baris.length ? <div className="overflow-x-auto"><table className="tabel-sip"><thead><tr><th>No</th><th>NIP</th><th>Nama</th><th>Jabatan</th><th>Berat (kg)</th><th>IMT</th><th>Kategori</th></tr></thead><tbody>{p.baris.map((b, i) => <tr key={b.nip}><td className="text-xs text-center">{i + 1}</td><td className="text-xs">{b.nip}</td><td className="text-sm font-medium">{b.nama}</td><td className="text-xs">{b.jabatan}</td><td className="text-xs text-center">{b.berat?.toFixed(1).replace('.', ',') ?? '—'}</td><td className="text-xs text-center">{b.imt?.toFixed(1).replace('.', ',') ?? '—'}</td><td className="text-xs">{b.kategori ?? 'Belum diukur'}</td></tr>)}</tbody></table></div> : <p className="px-4 py-5 text-sm text-abu-400">Belum ada data IMT pada periode ini.</p>}</section>)}</div>
      </div>
    </Kerangka>
  );
}
