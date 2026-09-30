import { redirect } from 'next/navigation';
import Link from 'next/link';
import { pegawaiDariSesi } from '@/lib/auth';
import { Kerangka } from '@/components/kerangka';
import { prisma } from '@/lib/db';
import {
  FormAjukanPegawai,
  AksiPengajuan,
  AksiBatalkan,
} from '@/components/kelola-pengajuan';
import { cabangYangBoleh } from '@/lib/sip/pengajuan';
import { BOLEH_MENGAJUKAN } from '@/lib/sip/pengajuan-konstanta';
import { LABEL_JENIS, WARNA_JENIS } from '@/lib/sip/hierarki';

export const metadata = { title: 'Pengajuan Pegawai' };

export default async function HalamanPengajuanPegawai() {
  const saya = await pegawaiDariSesi();
  if (!saya) redirect('/masuk');
  if (saya.harusGantiPassword) redirect('/ubah-password');
  if (!BOLEH_MENGAJUKAN.has(saya.role)) redirect('/dasbor');

  const isAdmin = saya.role === 'ADMIN';

  // cakupan cabang yang boleh diajukan
  const bolehCabangId = await cabangYangBoleh(saya.id, saya.role, saya.cabang.id);
  const [daftarCabang, daftarJabatan] = await Promise.all([
    prisma.cabang.findMany({
      where: { id: { in: bolehCabangId }, aktif: true },
      orderBy: { kode: 'asc' },
      select: { id: true, kode: true, nama: true, jenis: true },
    }),
    prisma.jabatan.findMany({ orderBy: { nama: 'asc' }, select: { id: true, nama: true } }),
  ]);

  // admin melihat semua pengajuan; supervisor hanya miliknya
  const daftar = await prisma.pengajuanPegawai.findMany({
    where: isAdmin ? {} : { pengajuId: saya.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      cabang: { select: { kode: true, nama: true, jenis: true } },
      jabatan: { select: { nama: true } },
      pengaju: { select: { nama: true, nip: true } },
      diputuskanOleh: { select: { nama: true } },
      pegawai: { select: { id: true, nip: true, nama: true } },
    },
    take: 100,
  });

  const menunggu = daftar.filter((p) => p.status === 'MENUNGGU');
  const selesai = daftar.filter((p) => p.status !== 'MENUNGGU');

  const LABEL_STATUS: Record<string, { teks: string; kelas: string }> = {
    MENUNGGU: { teks: 'Menunggu admin', kelas: 'bg-peringatan-bg text-peringatan' },
    DISETUJUI: { teks: 'Disetujui', kelas: 'bg-sukses-bg text-sukses' },
    DITOLAK: { teks: 'Ditolak', kelas: 'bg-bahaya-bg text-bahaya' },
  };

  const fmtWaktu = (t: Date | null) =>
    t
      ? t.toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '—';

  return (
    <Kerangka pegawai={saya}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="animasi-naik">
          <h1 className="text-2xl font-bold text-abu-900">Pengajuan Pegawai</h1>
          <div className="mt-2 h-0.5 w-10 bg-btn-merah-500 rounded-full" />
          <p className="mt-3 text-sm text-abu-500 leading-relaxed">
            {isAdmin
              ? 'Periksa pengajuan pegawai dari supervisor. Setujui untuk mengaktifkan, atau tolak dengan alasan.'
              : 'Menemukan petugas yang belum terdaftar? Ajukan di sini — admin akan memeriksa sebelum pegawai aktif.'}
          </p>
        </div>

        {/* ===== info alur ===== */}
        <div className="mt-5 rounded-lg border border-btn-biru-200 bg-btn-biru-50 px-4 py-3">
          <p className="text-xs leading-relaxed text-btn-biru-700">
            <strong>Kenapa lewat pengajuan?</strong> Data pegawai mengikat NIP
            resmi, jadi penambahan diperiksa admin supaya tidak ada NIP ganda
            atau pegawai yang salah unit. Pengajuan yang disetujui langsung
            aktif dan pegawai wajib mengganti password saat login pertama.
          </p>
        </div>

        {/* ===== formulir pengajuan ===== */}
        {daftarCabang.length > 0 ? (
          <FormAjukanPegawai
            daftarCabang={daftarCabang.map((c) => ({
              id: c.id, kode: c.kode, nama: c.nama, jenis: c.jenis,
            }))}
            daftarJabatan={daftarJabatan}
          />
        ) : (
          <div className="mt-6 kartu p-5 text-xs text-abu-500">
            Tidak ada unit kerja aktif dalam wewenang Anda.
          </div>
        )}

        {/* ===== menunggu keputusan ===== */}
        <div className="mt-8 flex items-baseline gap-3">
          <h2 className="text-sm font-semibold text-abu-800">Menunggu keputusan</h2>
          <span className="text-xs text-abu-400">{menunggu.length} pengajuan</span>
        </div>

        <div className="mt-3 kartu overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tabel-sip">
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Unit kerja</th>
                  <th>Jabatan</th>
                  {isAdmin && <th>Diajukan oleh</th>}
                  <th>Diajukan</th>
                  <th className="text-right">Keputusan</th>
                </tr>
              </thead>
              <tbody>
                {menunggu.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 6} className="text-center py-8 text-sm text-abu-400">
                      Tidak ada pengajuan yang menunggu.
                    </td>
                  </tr>
                )}
                {menunggu.map((p) => (
                  <tr key={p.id}>
                    <td className="tabular-nums text-xs text-abu-600">{p.nip}</td>
                    <td className="text-sm font-medium text-abu-900">
                      {p.nama}
                      {p.catatanPengaju && (
                        <span className="block text-[10px] text-abu-400 mt-0.5">
                          “{p.catatanPengaju}”
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-abu-600">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold mr-1.5 ${
                          WARNA_JENIS[p.cabang.jenis] ?? 'bg-abu-100 text-abu-600'
                        }`}
                      >
                        {LABEL_JENIS[p.cabang.jenis]}
                      </span>
                      {p.cabang.kode} — {p.cabang.nama}
                    </td>
                    <td className="text-xs text-abu-600">{p.jabatan?.nama ?? '—'}</td>
                    {isAdmin && (
                      <td className="text-xs text-abu-600">
                        {p.pengaju.nama}
                        <span className="block text-[10px] text-abu-400 tabular-nums">
                          {p.pengaju.nip}
                        </span>
                      </td>
                    )}
                    <td className="text-[11px] text-abu-500 tabular-nums">
                      {fmtWaktu(p.createdAt)}
                    </td>
                    <td className="text-right">
                      {isAdmin ? (
                        <AksiPengajuan pengajuanId={p.id} />
                      ) : (
                        <AksiBatalkan pengajuanId={p.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== riwayat ===== */}
        {selesai.length > 0 && (
          <>
            <div className="mt-8 flex items-baseline gap-3">
              <h2 className="text-sm font-semibold text-abu-800">Riwayat keputusan</h2>
              <span className="text-xs text-abu-400">{selesai.length} pengajuan</span>
            </div>

            <div className="mt-3 kartu overflow-hidden">
              <div className="overflow-x-auto">
                <table className="tabel-sip">
                  <thead>
                    <tr>
                      <th>NIP</th>
                      <th>Nama</th>
                      <th>Unit kerja</th>
                      <th>Status</th>
                      <th>Diputuskan</th>
                      <th>Catatan admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selesai.map((p) => {
                      const st = LABEL_STATUS[p.status];
                      return (
                        <tr key={p.id}>
                          <td className="tabular-nums text-xs text-abu-600">{p.nip}</td>
                          <td className="text-sm text-abu-800">
                            {p.pegawai ? (
                              <Link
                                href={`/pegawai/${p.pegawai.id}`}
                                className="font-medium hover:text-btn-biru-600 transition-colors"
                              >
                                {p.nama}
                              </Link>
                            ) : (
                              p.nama
                            )}
                          </td>
                          <td className="text-xs text-abu-600">
                            {p.cabang.kode} — {p.cabang.nama}
                          </td>
                          <td>
                            <span
                              className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${st.kelas}`}
                            >
                              {st.teks}
                            </span>
                          </td>
                          <td className="text-[11px] text-abu-500">
                            {fmtWaktu(p.diputuskanAt)}
                            {p.diputuskanOleh && (
                              <span className="block text-[10px] text-abu-400">
                                oleh {p.diputuskanOleh.nama}
                              </span>
                            )}
                          </td>
                          <td className="text-[11px] text-abu-500 max-w-[240px]">
                            {p.catatanAdmin ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Kerangka>
  );
}
