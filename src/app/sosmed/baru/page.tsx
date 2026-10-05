import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { FormKonten } from '@/components/form-konten';
import { daftarCalonPenyetuju } from '@/app/actions/sosmed';
import { bolehEfek } from '@/lib/sosmed/akses';

export const metadata = { title: 'Buat Konten' };

export default async function HalamanKontenBaru() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!bolehEfek(saya.role, 'kelola_konten')) redirect('/sosmed');

  const calon = await daftarCalonPenyetuju(saya);

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <Link href="/sosmed" className="text-xs text-abu-500 hover:text-abu-700">
            ← Kembali ke daftar konten
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-abu-900">Buat Konten</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500 leading-relaxed">
            Unggah berkas, tentukan platform tujuan dan penyetujunya. Setelah tersimpan sebagai
            draft, Anda masih bisa mengubahnya sebelum diajukan.
          </p>
        </div>

        {calon.length === 0 && (
          <div className="mt-6 rounded-lg border-l-[3px] border-peringatan bg-peringatan-bg px-4 py-3">
            <p className="text-xs font-semibold text-peringatan">Belum ada penyetuju</p>
            <p className="mt-0.5 text-[11px] text-abu-700 leading-relaxed">
              Tidak ada pegawai berperan Manager/Administrator selain Anda. Konten tetap bisa
              disimpan sebagai draft, tetapi belum dapat diajukan sampai ada penyetuju.
            </p>
          </div>
        )}

        <div className="mt-6">
          <FormKonten
            calonPenyetuju={calon.map((p) => ({
              id: p.id,
              nama: p.nama,
              nip: p.nip,
              jabatan: p.cabang?.nama ?? null,
            }))}
            sayaId={saya.id}
          />
        </div>
      </div>
    </Kerangka>
  );
}
