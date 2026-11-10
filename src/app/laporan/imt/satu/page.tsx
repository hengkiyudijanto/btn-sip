import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { susunRekapIMT } from '@/lib/sip/imt-rekap';
import { prisma } from '@/lib/db';
import { kumpulkanTurunan, type CabangRingkas } from '@/lib/sip/hierarki';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';

export const metadata = { title: 'Rekap IMT Satu Halaman' };
export default async function HalamanSatu({ searchParams }: { searchParams: Promise<{ periode?: string; cabang?: string; semua?: string }> }) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');
  const sp = await searchParams;
  const periode = sp.periode ? await prisma.periode.findUnique({ where: { id: sp.periode } }) : await pilihPeriodeRelevan();
  if (!periode) redirect('/laporan/imt');
  const cabang = await prisma.cabang.findMany();
  const ringkas: CabangRingkas[] = cabang.map((c) => ({ id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis, indukId: c.indukId, aktif: c.aktif }));
  const cabangIds = sp.cabang ? kumpulkanTurunan(sp.cabang, ringkas) : null;
  const data = (await susunRekapIMT({ periodeId: periode.id, cabangIds, semuaPegawai: sp.semua === '1' }))[0];
  return <div className="min-h-screen bg-white p-6 print:p-2"><div className="mx-auto max-w-[297mm]"><div className="mb-4 flex items-center justify-between print:hidden"><a href={`/laporan/imt?periode=${periode.id}`} className="text-sm text-btn-biru-700">← Kembali</a><button onClick={() => {}} className="rounded bg-btn-biru-600 px-3 py-2 text-xs font-semibold text-white" type="button">Gunakan Ctrl+P untuk cetak</button></div><h1 className="text-xl font-bold text-abu-900">REKAPITULASI INDEKS MASSA TUBUH</h1><p className="mt-1 text-sm text-abu-600">{data?.periode} · {data?.unit}</p><table className="mt-4 w-full border-collapse text-xs"><thead><tr className="bg-abu-100"><th className="border p-2">No</th><th className="border p-2">NIP</th><th className="border p-2 text-left">Nama</th><th className="border p-2 text-left">Jabatan</th><th className="border p-2">Berat awal (kg)</th><th className="border p-2">Berat (kg)</th><th className="border p-2">Naik/turun (kg)</th><th className="border p-2">IMT</th><th className="border p-2">Kategori</th></tr></thead><tbody>{data?.baris.map((b, i) => <tr key={b.nip}><td className="border p-2 text-center">{i + 1}</td><td className="border p-2">{b.nip}</td><td className="border p-2">{b.nama}</td><td className="border p-2">{b.jabatan}</td><td className="border p-2 text-center">{b.beratAwal?.toFixed(1) ?? '—'}</td><td className="border p-2 text-center">{b.berat?.toFixed(1) ?? '—'}</td><td className="border p-2 text-center">{b.perubahan == null ? '—' : `${b.perubahan > 0 ? '+' : ''}${b.perubahan.toFixed(1)}`}</td><td className="border p-2 text-center">{b.imt?.toFixed(1) ?? '—'}</td><td className="border p-2">{b.kategori ?? 'Belum diukur'}</td></tr>)}</tbody></table></div></div>;
}