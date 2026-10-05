'use client';

/**
 * Tombol & form aksi untuk satu konten: ajukan, setujui, minta revisi, tarik,
 * jadwalkan, arsipkan, dan kirim ke platform.
 *
 * Aturan yang dipegang: komponen ini HANYA menampilkan tombol yang relevan
 * menurut status; keputusan sebenarnya tetap divalidasi ulang di server action
 * (`transisiStatus`). Menyembunyikan tombol bukan pengamanan.
 */

import { useActionState, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import { ubahStatusKonten, kirimKeSosmed, type HasilAksi } from '@/app/actions/sosmed';
import { hasIlKirim, type PetaHasilKirim } from '@/lib/sosmed/hasil';

function Tombol({
  children,
  variasi = 'utama',
  nama,
  nilai,
}: {
  children: React.ReactNode;
  variasi?: 'utama' | 'sekunder' | 'bahaya';
  nama: string;
  nilai: string;
}) {
  const { sibuk, tandaiKirim } = useKirimForm();
  const kelas =
    variasi === 'utama'
      ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
      : variasi === 'bahaya'
        ? 'border border-btn-merah-500/40 bg-white text-btn-merah-700 hover:bg-btn-merah-100'
        : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50';

  return (
    <button
      type="submit"
      name={nama}
      value={nilai}
      disabled={sibuk}
      onClick={tandaiKirim}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${kelas}`}
    >
      {sibuk && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

function Pesan({ state }: { state: HasilAksi }) {
  if (state.error)
    return (
      <p className="mt-2 text-xs text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5 leading-relaxed">
        {state.error}
      </p>
    );
  if (state.sukses)
    return <p className="mt-2 text-xs text-sukses bg-sukses-bg rounded px-2.5 py-1.5">{state.pesan}</p>;
  return null;
}

type Props = {
  id: string;
  status: string;
  /** apakah saya pembuatnya */
  pemilik: boolean;
  /** apakah saya berhak menyetujui konten ini */
  penyetuju: boolean;
  sudahPunyaBerkas: boolean;
};

export function AksiKonten({ id, status, pemilik, penyetuju, sudahPunyaBerkas }: Props) {
  const [stateStatus, aksiStatus] = useActionState(ubahStatusKonten, {} as HasilAksi);
  const [stateKirim, aksiKirim] = useActionState(kirimKeSosmed, {} as HasilAksi);
  const [panelRevisi, setPanelRevisi] = useState(false);

  const bisaAjukan = pemilik && (status === 'DRAFT' || status === 'REVISI') && sudahPunyaBerkas;
  const bisaTarik = pemilik && status === 'MENUNGGU';
  const bisaSetujui = penyetuju && status === 'MENUNGGU';
  const bisaRevisi = penyetuju && (status === 'MENUNGGU' || status === 'DISETUJUI');
  const bisaKirim = status === 'DISETUJUI' || status === 'DIJADWALKAN';

  return (
    <div className="space-y-3">
      {/* ===== aksi utama ===== */}
      <div className="flex flex-wrap items-start gap-3">
        {bisaAjukan && (
          <form action={aksiStatus}>
            <input type="hidden" name="id" value={id} />
            <Tombol nama="aksi" nilai="AJUKAN">
              ➤ Ajukan untuk disetujui
            </Tombol>
            <Pesan state={stateStatus} />
          </form>
        )}

        {bisaTarik && (
          <form action={aksiStatus}>
            <input type="hidden" name="id" value={id} />
            <Tombol nama="aksi" nilai="TARIK" variasi="sekunder">
              ↩ Tarik pengajuan
            </Tombol>
            <Pesan state={stateStatus} />
          </form>
        )}

        {bisaSetujui && (
          <form action={aksiStatus}>
            <input type="hidden" name="id" value={id} />
            <Tombol nama="aksi" nilai="SETUJUI">
              ✓ Setujui konten
            </Tombol>
            <Pesan state={stateStatus} />
          </form>
        )}

        {bisaRevisi && !panelRevisi && (
          <button
            type="button"
            onClick={() => setPanelRevisi(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-btn-merah-500/40 bg-white px-4 py-2 text-sm font-semibold text-btn-merah-700 hover:bg-btn-merah-100 transition-colors"
          >
            ↩ Minta revisi
          </button>
        )}

        {bisaKirim && (
          <form action={aksiKirim}>
            <input type="hidden" name="id" value={id} />
            <Tombol nama="aksi" nilai="KIRIM">
              ⇪ Kirim ke platform
            </Tombol>
            <Pesan state={stateKirim} />
          </form>
        )}

        {pemilik && (status === 'DRAFT' || status === 'REVISI') && (
          <form action={aksiStatus}>
            <input type="hidden" name="id" value={id} />
            <Tombol nama="aksi" nilai="ARSIPKAN" variasi="sekunder">
              Arsipkan
            </Tombol>
            <Pesan state={stateStatus} />
          </form>
        )}
      </div>

      {/* ===== alasan kalau tombol utama tidak tersedia ===== */}
      {pemilik && (status === 'DRAFT' || status === 'REVISI') && !sudahPunyaBerkas && (
        <p className="text-[11px] text-peringatan bg-peringatan-bg rounded px-2.5 py-1.5">
          Unggah berkas dulu — konten tanpa berkas tidak dapat diajukan.
        </p>
      )}

      {/* ===== panel alasan revisi ===== */}
      {panelRevisi && bisaRevisi && (
        <form action={aksiStatus} className="animasi-naik rounded-lg border border-abu-200 bg-abu-50 p-3.5">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="aksi" value="MINTA_REVISI" />
          <label htmlFor={`alasan-${id}`} className="block text-xs font-medium text-abu-600 mb-1.5">
            Alasan revisi (wajib — kreator akan membaca ini apa adanya)
          </label>
          <textarea
            id={`alasan-${id}`}
            name="catatan"
            rows={2}
            required
            placeholder="Mis. caption menyebut produk yang belum boleh dipromosikan periode ini"
            className="w-full rounded-lg border border-abu-300 px-3 py-2 text-xs focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none resize-y"
          />
          <div className="mt-2 flex gap-2">
            <Tombol nama="aksi" nilai="MINTA_REVISI" variasi="bahaya">
              Kembalikan untuk revisi
            </Tombol>
            <button
              type="button"
              onClick={() => setPanelRevisi(false)}
              className="rounded-lg border border-abu-300 px-4 py-2 text-sm text-abu-600 hover:bg-abu-50 transition-colors"
            >
              Batal
            </button>
          </div>
          <Pesan state={stateStatus} />
        </form>
      )}

      {/* ===== panel jadwal ===== */}
      {bisaKirim && (
        <details className="text-xs">
          <summary className="cursor-pointer text-abu-500 hover:text-abu-700">
            atau jadwalkan pengiriman otomatis
          </summary>
          <form action={aksiStatus} className="mt-2 flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="aksi" value="JADWALKAN" />
            <div>
              <label htmlFor={`jadwal-${id}`} className="block text-[11px] text-abu-500 mb-1">
                Waktu kirim
              </label>
              <input
                id={`jadwal-${id}`}
                type="datetime-local"
                name="jadwalAt"
                required
                className="rounded-lg border border-abu-300 px-3 py-1.5 text-xs focus:border-btn-biru-500 focus:outline-none"
              />
            </div>
            <Tombol nama="aksi" nilai="JADWALKAN" variasi="sekunder">
              Jadwalkan
            </Tombol>
            <Pesan state={stateStatus} />
          </form>
        </details>
      )}

      {status === 'DIJADWALKAN' && (
        <form action={aksiStatus} className="inline">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            name="aksi"
            value="BATAL_JADWAL"
            className="text-[11px] font-medium text-btn-merah-700 hover:underline"
          >
            Batalkan jadwal
          </button>
          <Pesan state={stateStatus} />
        </form>
      )}
    </div>
  );
}

// ===========================================================================
// Panel hasil kirim (dibaca dari kolom JSON hasilKirim)
// ===========================================================================

export function HasilKirim({ hasil }: { hasil: unknown }) {
  if (!hasIlKirim(hasil)) return null;
  const peta = hasil as PetaHasilKirim;

  return (
    <div className="rounded-lg border border-abu-200 bg-abu-50 p-3.5">
      <p className="text-[11px] font-semibold text-abu-600 mb-2">Hasil pengiriman terakhir</p>
      <ul className="space-y-2">
        {Object.entries(peta).map(([platform, h]) => (
          <li key={platform} className="text-xs">
            <span className="font-semibold text-abu-800">{platform}</span>{' '}
            <span className={h.berhasil ? 'text-sukses' : 'text-bahaya'}>
              {h.berhasil ? 'berhasil' : 'GAGAL'}
            </span>
            <span className="block text-[11px] text-abu-500 leading-relaxed mt-0.5">{h.pesan}</span>
            {h.urlPublik && (
              <a
                href={h.urlPublik}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-btn-biru-600 hover:underline break-all"
              >
                {h.urlPublik}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
