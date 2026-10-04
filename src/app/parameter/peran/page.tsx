import { redirect } from 'next/navigation';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import { SEMUA_PERAN, KETERANGAN_PERAN, type Peran } from '@/lib/sip/akses';

export const metadata = { title: 'Peran' };

/**
 * Urutan tampil: dari hak akses terluas ke tersempit.
 *
 * Daftar peran dan keterangannya diambil dari `@/lib/sip/akses` — SATU sumber.
 * Jangan tulis ulang daftarnya di sini: waktu peran `PENGAMAT` ditambahkan,
 * halaman ini sempat tidak menampilkannya karena daftarnya disalin terpisah.
 */
const URUTAN: Peran[] = [...SEMUA_PERAN].reverse();

export default async function HalamanPeran() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (saya.role !== 'ADMIN') redirect('/dasbor');

  const hitung = await prisma.pegawai.groupBy({
    by: ['role'],
    _count: { _all: true },
  });
  const jumlah = new Map(hitung.map((h) => [h.role, h._count._all]));

  const daftar = URUTAN.map((kode) => ({
    kode,
    keterangan: KETERANGAN_PERAN[kode] ?? '',
    jumlah: jumlah.get(kode as never) ?? 0,
  }));

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8">
        <div>
          <h1 className="text-xl font-semibold text-abu-900">Peran</h1>
          <p className="mt-1 text-sm text-abu-500">
            Peran menentukan apa yang bisa dilakukan pengguna di aplikasi.
          </p>
        </div>

        <div className="kartu mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip tabel-lebar-tetap">
              <colgroup>
                <col style={{ width: '20%' }} />
                <col style={{ width: '58%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Peran</th>
                  <th>Hak akses</th>
                  <th className="text-right">Jumlah pengguna</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((p) => (
                  <tr key={p.kode}>
                    <td>
                      <span className="inline-block rounded-md bg-btn-biru-50 px-2.5 py-1 text-xs font-semibold text-btn-biru-800">
                        {p.kode}
                      </span>
                    </td>
                    <td className="text-sm text-abu-700">{p.keterangan}</td>
                    <td className="text-right text-sm tabular-nums text-abu-700">
                      {p.jumlah}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="kartu mt-6 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-abu-900">
            Peran belum bisa diubah dari layar ini
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-abu-600">
            Peran saat ini tersimpan sebagai <strong>enum</strong> di database —
            nilainya terkunci di skema dan dipakai langsung oleh kode program
            untuk menentukan hak akses. Supaya bisa ditambah atau diubah dari
            layar ini, peran perlu dipindah menjadi tabel tersendiri lebih dulu.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-abu-600">
            Kalau ada peran baru yang dibutuhkan (misalnya Kepala Cabang atau
            Pemimpin Bidang), sebutkan saja — daftarnya akan difinalkan dulu,
            baru dipindah ke tabel sekaligus, supaya tidak perlu migrasi dua kali.
          </p>
        </div>
      </div>
    </Kerangka>
  );
}
