'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { kompresFoto, ukuranDataUrl, formatUkuran, UKURAN_FOTO } from '@/lib/foto';
import { simpanFoto, hapusFoto, simpanFotoDariUrl, type HasilFoto } from '@/app/actions/foto';

function TombolSimpan({ label = 'Simpan foto' }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-btn-biru-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-btn-biru-700 disabled:opacity-60 transition-colors"
    >
      {pending && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {label}
    </button>
  );
}

/**
 * Panel unggah foto pegawai.
 * Gambar dikompres di browser dulu (3:4, ≤80 KB) sebelum dikirim ke server.
 */
export function UnggahFoto({
  pegawaiId,
  nama,
  fotoUrl,
  ukuranAwal,
}: {
  pegawaiId: string;
  nama: string;
  fotoUrl: string | null;
  ukuranAwal: number | null;
}) {
  const [state, aksi] = useActionState(simpanFoto, {});
  const [stateHapus, aksiHapus] = useActionState(hapusFoto, {});
  const [stateUrl, aksiUrl] = useActionState(simpanFotoDariUrl, {});
  const [pratinjau, setPratinjau] = useState<string | null>(fotoUrl);
  const [info, setInfo] = useState<{ byte: number; lebar: number; tinggi: number } | null>(
    ukuranAwal ? { byte: ukuranAwal, lebar: UKURAN_FOTO.lebar, tinggi: UKURAN_FOTO.tinggi } : null
  );
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [modeUrl, setModeUrl] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const pilihBerkas = async (f: File) => {
    setGalat(null);
    setProses(true);
    try {
      const hasil = await kompresFoto(f);
      setPratinjau(hasil.dataUrl);
      setInfo({ byte: hasil.byte, lebar: hasil.lebar, tinggi: hasil.tinggi });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memproses gambar.');
      setPratinjau(null);
      setInfo(null);
    } finally {
      setProses(false);
    }
  };

  const adaFoto = Boolean(pratinjau);
  const hematPersen =
    info && info.byte > 0 ? Math.round((1 - info.byte / (ukuranDataUrl(pratinjau ?? '') || 1)) * 100) : 0;

  return (
    <div className="kartu p-5">
      <h3 className="text-sm font-semibold text-abu-800 mb-1">Foto pegawai (3 &times; 4)</h3>
      <p className="text-xs text-abu-500 mb-4 leading-relaxed">
        Foto dikompres otomatis di peramban menjadi 3:4 dan maksimal{' '}
        {formatUkuran(UKURAN_FOTO.maksByte)} sebelum dikirim, jadi tidak membebani koneksi.
        Foto ini akan tampil di laporan SIP.
      </p>

      <div className="flex flex-wrap gap-5">
        {/* ===== pratinjau ===== */}
        <div className="shrink-0">
          <div
            className="rounded-lg border-2 border-dashed border-abu-300 bg-abu-50 flex items-center justify-center overflow-hidden"
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
                alt={`Foto ${nama}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span className="text-[10px] text-abu-400 text-center px-2">Belum ada foto</span>
            )}
          </div>
          {info && !proses && (
            <p className="mt-1.5 text-[10px] text-abu-400 text-center tabular-nums">
              {info.lebar}&times;{info.tinggi} &middot; {formatUkuran(info.byte)}
            </p>
          )}
        </div>

        {/* ===== kontrol ===== */}
        <div className="flex-1 min-w-[260px] space-y-3">
          <form
            action={aksi}
            onSubmit={(e) => {
              // pastikan data gambar ikut terkirim
              if (!pratinjau) {
                e.preventDefault();
                setGalat('Pilih foto terlebih dahulu.');
              }
            }}
          >
            <input type="hidden" name="pegawaiId" value={pegawaiId} />
            <input type="hidden" name="dataUrl" value={pratinjau ?? ''} />
            <input type="hidden" name="mime" value="image/jpeg" />
            <input type="hidden" name="byte" value={info?.byte ?? 0} />

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={berkas}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pilihBerkas(f);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => berkas.current?.click()}
                disabled={proses}
                className="rounded-lg border border-abu-300 bg-white px-3.5 py-2 text-xs font-medium text-abu-700 hover:bg-abu-50 disabled:opacity-60 transition-colors"
              >
                {adaFoto ? 'Ganti file' : 'Pilih file foto'}
              </button>

              {pratinjau && <TombolSimpan label={adaFoto && ukuranAwal ? 'Perbarui foto' : 'Simpan foto'} />}

              <button
                type="button"
                onClick={() => setModeUrl((v) => !v)}
                className="text-[11px] font-medium text-btn-biru-600 hover:underline"
              >
                {modeUrl ? 'Sembunyikan URL' : 'atau pakai URL'}
              </button>
            </div>
          </form>

          {/* ===== mode URL ===== */}
          {modeUrl && (
            <form action={aksiUrl} className="flex gap-2 animasi-naik">
              <input type="hidden" name="pegawaiId" value={pegawaiId} />
              <input
                name="fotoUrl"
                placeholder="https://... (foto dari server lain)"
                className="flex-1 rounded-lg border border-abu-300 px-3 py-2 text-xs focus:border-btn-biru-500 focus:outline-none"
              />
              <TombolSimpan label="Simpan URL" />
            </form>
          )}

          {/* ===== hapus ===== */}
          {ukuranAwal && !modeUrl && (
            <form action={aksiHapus} className="inline">
              <input type="hidden" name="pegawaiId" value={pegawaiId} />
              <button
                type="submit"
                className="text-[11px] font-medium text-btn-merah-700 hover:underline"
              >
                Hapus foto
              </button>
            </form>
          )}

          {/* ===== pesan ===== */}
          {galat && (
            <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{galat}</p>
          )}
          {state.error && (
            <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{state.error}</p>
          )}
          {state.sukses && (
            <p className="text-[11px] text-sukses bg-sukses-bg rounded px-2.5 py-1.5">
              {state.pesan}
            </p>
          )}
          {stateHapus.sukses && (
            <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2.5 py-1.5">
              {stateHapus.pesan}
            </p>
          )}
          {stateUrl.sukses && (
            <p className="text-[11px] text-sukses bg-sukses-bg rounded px-2.5 py-1.5">
              {stateUrl.pesan}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
