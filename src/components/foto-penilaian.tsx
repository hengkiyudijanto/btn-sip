'use client';

import { useActionState, useRef, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import { kompresFoto, ukuranDataUrl, formatUkuran, UKURAN_FOTO } from '@/lib/foto';
import {
  simpanFotoPenilaianAksi,
  hapusFotoPenilaianAksi,
  type HasilFotoPenilaian,
} from '@/app/actions/foto-penilaian';

function Tombol({ label, variasi = 'utama' }: { label: string; variasi?: 'utama' | 'polos' }) {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  const warna =
    variasi === 'utama'
      ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
      : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50';
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={tandaiKirim}
      className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${warna}`}
    >
      {pending ? 'Menyimpan...' : label}
    </button>
  );
}

/**
 * Panel foto penilaian.
 *
 * Foto melekat pada penilaian (per periode), bukan pada pegawai. Foto
 * dikompres di peramban dulu (3x4, maks 80 KB) supaya tidak membebani
 * koneksi di cabang.
 */
export function FotoPenilaian({
  penilaianId,
  fotoUrl,
  ukuranAwal,
  catatanAwal,
  terkunci,
  wajibFoto,
}: {
  penilaianId: string;
  fotoUrl: string | null;
  ukuranAwal: number | null;
  catatanAwal: string | null;
  terkunci: boolean;
  wajibFoto: boolean;
}) {
  const [stateSimpan, aksiSimpan] = useActionState(simpanFotoPenilaianAksi, {} as HasilFotoPenilaian);
  const [stateHapus, aksiHapus] = useActionState(hapusFotoPenilaianAksi, {} as HasilFotoPenilaian);
  const [pratinjau, setPratinjau] = useState<string | null>(fotoUrl);
  const [info, setInfo] = useState<{ byte: number; lebar: number; tinggi: number } | null>(
    ukuranAwal ? { byte: ukuranAwal, lebar: UKURAN_FOTO.lebar, tinggi: UKURAN_FOTO.tinggi } : null
  );
  const [proses, setProses] = useState(false);
  const [galatLokal, setGalatLokal] = useState<string | null>(null);
  const berkas = useRef<HTMLInputElement>(null);

  const pilihBerkas = async (f: File) => {
    setGalatLokal(null);
    setProses(true);
    try {
      const hasil = await kompresFoto(f);
      setPratinjau(hasil.dataUrl);
      setInfo({ byte: hasil.byte, lebar: hasil.lebar, tinggi: hasil.tinggi });
    } catch (e) {
      setGalatLokal(e instanceof Error ? e.message : 'Gagal memproses gambar.');
      setPratinjau(null);
      setInfo(null);
    } finally {
      setProses(false);
    }
  };

  const adaFoto = Boolean(pratinjau);
  const fotoTersimpan = Boolean(ukuranAwal);
  const belumDisimpan = adaFoto && pratinjau !== fotoUrl;
  const hematPersen =
    info && pratinjau
      ? Math.max(
          0,
          Math.round((1 - info.byte / (ukuranDataUrl(pratinjau) || info.byte)) * 100)
        )
      : 0;

  return (
    <div className="kartu p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-sm font-semibold text-abu-800">
          Foto penilaian (3 &times; 4)
          {wajibFoto && <span className="ml-2 text-[10px] font-normal text-btn-merah-600">wajib untuk dikirim</span>}
        </h3>
        {fotoTersimpan && !terkunci && (
          <form action={aksiHapus}>
            <input type="hidden" name="penilaianId" value={penilaianId} />
            <button
              type="submit"
              className="text-[11px] font-medium text-btn-merah-700 hover:underline"
            >
              Hapus foto
            </button>
          </form>
        )}
      </div>

      <p className="text-xs text-abu-500 mb-4 leading-relaxed">
        Foto kondisi petugas pada periode ini — kerapihan seragam, kelengkapan
        atribut, kebersihan area. Dikompres otomatis di peramban jadi 3:4 dan
        maksimal {formatUkuran(UKURAN_FOTO.maksByte)}, lalu tampil di lembar
        laporan SIP.
      </p>

      <div className="flex flex-wrap gap-5">
        {/* ===== pratinjau ===== */}
        <div className="shrink-0">
          <div
            className={`rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden ${
              adaFoto ? 'border-abu-300 bg-abu-50' : 'border-peringatan/40 bg-peringatan-bg'
            }`}
            style={{ width: '105px', height: '140px' }}
          >
            {proses ? (
              <svg className="animate-spin h-6 w-6 text-abu-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : pratinjau ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pratinjau}
                alt="Foto penilaian"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span className="text-[10px] text-peringatan text-center px-2 font-medium">
                Belum ada foto
              </span>
            )}
          </div>
          {info && !proses && (
            <p className="mt-1.5 text-[10px] text-abu-400 text-center tabular-nums">
              {info.lebar}&times;{info.tinggi} &middot; {formatUkuran(info.byte)}
              {hematPersen > 0 && ` (hemat ${hematPersen}%)`}
            </p>
          )}
          {belumDisimpan && (
            <p className="mt-1 text-[10px] text-peringatan text-center font-medium">
              belum disimpan
            </p>
          )}
        </div>

        {/* ===== kontrol ===== */}
        <div className="flex-1 min-w-[260px] space-y-3">
          <form
            action={aksiSimpan}
            onSubmit={(e) => {
              if (!pratinjau) {
                e.preventDefault();
                setGalatLokal('Pilih foto terlebih dahulu.');
              }
            }}
          >
            <input type="hidden" name="penilaianId" value={penilaianId} />
            <input type="hidden" name="dataUrl" value={pratinjau ?? ''} />
            <input type="hidden" name="mime" value="image/jpeg" />
            <input type="hidden" name="byte" value={info?.byte ?? 0} />

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                ref={berkas}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pilihBerkas(f);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => berkas.current?.click()}
                disabled={proses || terkunci}
                className="rounded-lg border border-abu-300 bg-white px-3.5 py-2 text-xs font-medium text-abu-700 hover:bg-abu-50 disabled:opacity-60 transition-colors"
              >
                {adaFoto ? 'Ganti foto' : 'Pilih / ambil foto'}
              </button>
              {pratinjau && !terkunci && (
                <Tombol label={belumDisimpan ? 'Simpan foto' : 'Simpan ulang'} />
              )}
            </div>

            <div>
              <label className="block text-[11px] text-abu-500 mb-1">
                Keterangan foto (opsional)
              </label>
              <input
                name="catatan"
                defaultValue={catatanAwal ?? ''}
                disabled={terkunci}
                placeholder="mis. seragam lengkap dengan name tag"
                className="w-full rounded-lg border border-abu-300 px-3 py-1.5 text-xs focus:border-btn-biru-500 focus:outline-none disabled:bg-abu-50"
              />
            </div>
          </form>

          {terkunci && (
            <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2.5 py-1.5 leading-relaxed">
              🔒 Periode sudah dikunci — foto tidak dapat diubah.
            </p>
          )}

          {galatLokal && (
            <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{galatLokal}</p>
          )}
          {stateSimpan.error && (
            <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">
              {stateSimpan.error}
            </p>
          )}
          {stateSimpan.sukses && (
            <p className="text-[11px] text-sukses bg-sukses-bg rounded px-2.5 py-1.5">
              {stateSimpan.pesan}
              {stateSimpan.ukuran ? ` (${formatUkuran(stateSimpan.ukuran)})` : ''}
            </p>
          )}
          {stateHapus.error && (
            <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">
              {stateHapus.error}
            </p>
          )}
          {stateHapus.sukses && (
            <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2.5 py-1.5">
              {stateHapus.pesan}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
