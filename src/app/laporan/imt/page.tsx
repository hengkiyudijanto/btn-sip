import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Kerangka } from '@/components/kerangka';
import { bolehBukaHalaman, boleh } from '@/lib/sip/akses';
import { susunRekapIMT } from '@/lib/sip/imt-rekap';
import { kumpulkanTurunan, susunPohon, LABEL_JENIS, type CabangRingkas } from '@/lib/sip/hierarki';
import { pilihPeriodeRelevan, daftarPeriodeUntukPemilih } from '@/lib/sip/periode-aktif';

export const metadata = { title: 'Laporan Rekap IMT' };

export default async function HalamanRekapIMT({ searchParams }: { searchParams: Promise<{ periode?: string; cabang?: string; semua?: string }> }) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');
  const sp = await searchParams;
  const semuaPegawai = sp.semua === '1';
  const daftarPeriode = await daftarPeriodeUntukPemilih();
  const periode = sp.periode ? (daftarPeriode.find((p) => p.id === sp.periode) ?? await pilihPeriodeRelevan()) : await pilihPeriodeRelevan();
  const semuaCabang = await prisma.cabang.findMany({ orderBy: { kode: 'asc' } });
  const bolehSemua = boleh(saya.role, 'lihat_semua_cabang');
  const cabangPilihan = bolehSemua ? semuaCabang.filter((c) => c.aktif) : [];
  const unit = sp.cabang ? semuaCabang.find((c) => c.id === sp.cabang) : null;
  const ringkasCabang: CabangRingkas[] = semuaCabang.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis, indukId: c.indukId, aktif: c.aktif }));
  const cabangIds = unit ? kumpulkanTurunan(unit.id, ringkasCabang) : bolehSemua ? null : [saya.cabang.id];
  const rekap = periode ? await susunRekapIMT({ periodeId: periode.id, cabangIds, semuaPegawai }) : [];

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <div><h1 className="text-2xl font-bold text-abu-900">Laporan Rekap IMT</h1><p className="mt-2 text-sm text-abu-500">Filter mengikuti Rekap SIP: periode dan unit kerja.</p></div>
        <form className="mt-6 kartu p-5" method="get"><div className={`grid gap-4 ${bolehSemua && cabangPilihan.length ? 'sm:grid-cols-2' : ''}`}>
          <label className="text-xs text-abu-600">Periode<select name="periode" defaultValue={periode?.id ?? ''} className="mt-1 block w-full rounded-lg border border-abu-300 px-3 py-2 text-sm">{daftarPeriode.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}</select></label>
          {bolehSemua && cabangPilihan.length > 0 && <label className="text-xs text-abu-600">Unit kerja<select name="cabang" defaultValue={unit?.id ?? ''} className="mt-1 block w-full rounded-lg border border-abu-300 px-3 py-2 text-sm"><option value="">Semua unit</option>{susunPohon(cabangPilihan.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis, indukId: c.indukId, aktif: c.aktif }))).map((c) => <option key={c.id} value={c.id}>{' '.repeat(c.kedalaman * 3)}{LABEL_JENIS[c.jenis]} {c.kode} — {c.nama}</option>)}</select></label>}
        </div><div className="mt-4 flex flex-wrap items-center gap-3"><button className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white">Tampilkan</button><label className="inline-flex items-center gap-2 text-sm text-abu-700"><input type="checkbox" name="semua" value="1" defaultChecked={semuaPegawai} /> Termasuk semua pegawai (termasuk yang belum diukur)</label></div></form>
        <div className="mt-4 flex flex-wrap items-center gap-3">{periode && <form action="/laporan/imt/pptx" method="get"><input type="hidden" name="periode" value={periode.id} />{unit && <input type="hidden" name="cabang" value={unit.id} />}{semuaPegawai && <input type="hidden" name="semua" value="1" />}<button className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white">Cetak PPT Landscape</button></form>}{periode && <a href={`/laporan/imt/satu?periode=${periode.id}${unit ? `&cabang=${unit.id}` : ''}${semuaPegawai ? '&semua=1' : ''}`} className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white">Cetak / Simpan PDF</a>}<span className="text-xs text-abu-500">{unit ? `Cakupan: ${unit.nama} beserta turunannya` : 'Cakupan: semua unit yang berwenang'}</span></div>
        <div className="mt-6 space-y-6">{rekap.map((p) => { const kantor = new Map<string, typeof p.baris>(); for (const b of p.baris) (kantor.get(b.kantor) ?? (kantor.set(b.kantor, []), kantor.get(b.kantor)!)).push(b); return <section key={p.periode}><h2 className="mb-3 text-lg font-bold text-abu-900">{p.periode} · {p.unit}</h2>{[...kantor.entries()].map(([namaKantor, baris]) => <div key={namaKantor} className="kartu mb-5 overflow-hidden"><h3 className="border-b border-abu-200 bg-abu-50 px-4 py-3 text-sm font-bold text-abu-900">{namaKantor}</h3><div className="overflow-x-auto"><table className="tabel-sip"><thead><tr><th>No</th><th>Foto</th><th>Nama</th><th>Unit kerja</th><th>Berat awal</th><th>Berat</th><th>Naik/turun</th><th>IMT</th><th>Kategori</th></tr></thead><tbody>{baris.map((b, i) => <tr key={b.nip}><td className="text-center text-xs">{i + 1}</td><td className="text-center"><div className="mx-auto h-12 w-9 overflow-hidden rounded border bg-abu-50">{b.foto && <img src={b.foto} alt="" className="h-full w-full object-contain" />}</div></td><td className="font-medium">{b.nama}<div className="text-[10px] text-abu-500">{b.nip}</div></td><td>{b.unitKerja}</td><td className="text-center">{b.beratAwal?.toFixed(1) ?? '—'}</td><td className="text-center">{b.berat?.toFixed(1) ?? '—'}</td><td className="text-center">{b.perubahan == null ? '—' : `${b.perubahan > 0 ? '+' : ''}${b.perubahan.toFixed(1)}`}</td><td className="text-center">{b.imt?.toFixed(1) ?? '—'}</td><td>{b.kategori ?? 'Belum diukur'}</td></tr>)}</tbody></table></div></div>)}</section>; })}</div>
      </div>
    </Kerangka>
  );
}
