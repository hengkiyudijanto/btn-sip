import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { bolehBukaHalaman } from '@/lib/sip/akses';
import { tahunRekapIMT } from '@/lib/sip/imt-rekap';

export const metadata = { title: 'Rekap IMT' };

export default async function HalamanRekapIMT() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (!bolehBukaHalaman(saya.role, '/laporan/ranking')) redirect('/dasbor');
  const tahun = await tahunRekapIMT();
  const tahunDefault = tahun[0] ?? new Date().getFullYear();
  return <Kerangka pegawai={saya}><div className="mx-auto max-w-6xl px-4 sm:px-6 py-8"><h1 className="text-2xl font-bold text-abu-900">Rekapitulasi Indeks Massa Tubuh</h1><p className="mt-2 text-sm text-abu-500">Laporan landscape seperti ranking PPTX, dengan berat badan terakhir setiap pegawai pada tiap pekan.</p><form className="mt-6 kartu p-5 flex flex-wrap items-end gap-4" action="/laporan/imt/pptx" method="get"><label className="text-xs text-abu-600">Tahun<select name="tahun" defaultValue={tahunDefault} className="mt-1 block rounded-lg border border-abu-300 px-3 py-2 text-sm">{tahun.map((t) => <option key={t} value={t}>{t}</option>)}</select></label><button className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white">Unduh Rekap PPTX</button></form><div className="mt-4 rounded-lg bg-abu-50 p-4 text-xs text-abu-600">Satu slide mewakili satu periode mingguan. Jika pegawai diukur beberapa kali dalam pekan yang sama, laporan mengambil pengukuran terakhir pada pekan tersebut.</div></div></Kerangka>;
}
