import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { boleh, bolehBukaHalaman } from '@/lib/sip/akses';
import { kelompokkanBarisRekapIMT, susunRekapIMT } from '@/lib/sip/imt-rekap';
import { cakupanCabangRekapIMT } from '@/lib/sip/imt-rekap-cakupan';
import { prisma } from '@/lib/db';
import { pilihPeriodeRelevan } from '@/lib/sip/periode-aktif';
import { TombolCetak } from '@/components/tombol-cetak';

export const metadata = { title: 'Rekap IMT Satu Halaman' };
export default async function HalamanSatu({ searchParams }: { searchParams: Promise<{ periode?: string; cabang?: string; semua?: string; tanggal?: string }> }) {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');
  const sp = await searchParams;
  const periode = sp.periode ? await prisma.periode.findUnique({ where: { id: sp.periode } }) : await pilihPeriodeRelevan();
  if (!periode) redirect('/laporan/imt');
  const cabang = await prisma.cabang.findMany({ select: { id: true, indukId: true } });
  const cabangIds = cakupanCabangRekapIMT({ bolehSemua: boleh(saya.role, 'lihat_semua_cabang'), cabangPenggunaId: saya.cabang.id, cabangDimintaId: sp.cabang ?? null, pohon: cabang });
  const tanggal = sp.tanggal && /^\d{4}-\d{2}-\d{2}$/.test(sp.tanggal) ? new Date(`${sp.tanggal}T00:00:00.000Z`) : undefined;
  const data = (await susunRekapIMT({ periodeId: periode.id, cabangIds, semuaPegawai: sp.semua === '1', tanggal }))[0];
  const warnaKategori = (kategori: string | null) => kategori === 'Normal' ? 'bg-[#d1fae5] text-[#047857]' : kategori === 'Berlebih' ? 'bg-[#fce7f3] text-[#be185d]' : kategori === 'Obesitas' ? 'bg-[#991b1b] text-white' : kategori === 'Kurus' ? 'bg-[#e0f2fe] text-[#0369a1]' : 'bg-abu-100 text-abu-500';
  return (
    <div className="min-h-screen bg-abu-100 print:bg-white p-6 print:p-2">
      <div className="mx-auto max-w-[297mm]">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <a href={`/laporan/imt?periode=${periode.id}`} className="text-sm text-btn-biru-700">← Kembali</a>
          <TombolCetak label="Cetak / Simpan PDF" />
        </div>
        <div className="rounded border-t-4 border-btn-biru-700 bg-white p-5 print:border-t-0">
          <div className="text-[11px] font-bold text-btn-biru-700">PT BANK TABUNGAN NEGARA (PERSERO) TBK</div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-abu-900">REKAPITULASI INDEKS MASSA TUBUH</h1>
          <p className="mt-1 text-sm text-abu-600">{data?.periode} · {data?.unit}</p>
          <p className="text-sm text-abu-600">Tanggal pengukuran: {data?.tanggal.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          {data && kelompokkanBarisRekapIMT(data.baris).map((group) => <div key={`${group.kantor}-${group.unitKerja}`} className="mb-5 break-inside-avoid"><h3 className="mb-2 border-b-2 border-btn-biru-700 pb-1 text-sm font-bold text-abu-900">{group.kantor} · {group.unitKerja}</h3><table className="w-full table-fixed border-collapse text-xs"><colgroup><col style={{ width: '4%' }} /><col style={{ width: '7%' }} /><col style={{ width: '22%' }} /><col style={{ width: '15%' }} /><col style={{ width: '10%' }} /><col style={{ width: '8%' }} /><col style={{ width: '11%' }} /><col style={{ width: '8%' }} /><col style={{ width: '15%' }} /></colgroup><thead><tr className="bg-[#1226AA] text-white"><th>No</th><th>Foto</th><th className="text-left">Nama</th><th className="text-left">Unit kerja</th><th>Berat awal</th><th>Berat</th><th>Naik/turun</th><th>IMT</th><th>Kategori</th></tr></thead><tbody>
            {group.baris.map((b, i) => <tr key={b.nip} className={i % 2 ? 'bg-[#f8fafc]' : 'bg-white'}><td className="border border-abu-200 p-2 text-center">{i + 1}</td><td className="border border-abu-200 p-1 text-center"><div className="mx-auto flex h-16 w-12 items-center justify-center overflow-hidden rounded border border-abu-200 bg-abu-50">{b.foto ? <img src={b.foto} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-abu-400">—</span>}</div></td><td className="border border-abu-200 p-2 font-semibold">{b.nama}<div className="text-[10px] font-normal text-abu-500">{b.nip}</div></td><td className="border border-abu-200 p-2">{b.unitKerja}</td><td className="border border-abu-200 p-2 text-center">{b.beratAwal?.toFixed(1) ?? '—'}</td><td className="border border-abu-200 p-2 text-center">{b.berat?.toFixed(1) ?? '—'}</td><td className="border border-abu-200 p-2 text-center">{b.perubahan == null ? '—' : `${b.perubahan > 0 ? '+' : ''}${b.perubahan.toFixed(1)}`}</td><td className="border border-abu-200 p-2 text-center font-semibold">{b.imt?.toFixed(1) ?? '—'}</td><td className="border border-abu-200 p-2 text-center"><span className={`inline-block rounded-full px-2 py-1 text-[10px] font-bold ${warnaKategori(b.kategori)}`}>{b.kategori ?? 'Belum diukur'}</span></td></tr>)}
          </tbody></table></div>)}
          <div className="mt-4 flex flex-wrap gap-3 text-[10px]"><span className="rounded bg-[#d1fae5] px-2 py-1 text-[#047857]">Normal</span><span className="rounded bg-[#fce7f3] px-2 py-1 text-[#be185d]">Berlebih</span><span className="rounded bg-[#991b1b] px-2 py-1 text-white">Obesitas</span></div>
        </div>
      </div>
    </div>
  );
}