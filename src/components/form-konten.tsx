'use client';

/**
 * Form unggah konten sosmed.
 *
 * Alur: pilih berkas -> dibaca/dikompres di peramban (src/lib/sosmed/media.ts)
 * -> data URL dikirim ke server lewat server action -> server menyimpannya.
 * Video TIDAK dikompres (tidak ada encoder yang layak di peramban); ukurannya
 * dibatasi dan itu disebutkan apa adanya di UI.
 *
 * Tombol submit memakai `useKirimForm()` — BUKAN `useFormStatus().pending`
 * mentah, karena pending bernilai true saat HTML dirender di server dan
 * membuat semua tombol tercetak nonaktif (bug yang pernah menyebar di proyek
 * ini; lihat src/components/use-kirim-form.ts).
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { simpanKonten, hapusMediaKonten, type HasilAksi } from '@/app/actions/sosmed';
import { useKirimForm } from '@/components/use-kirim-form';
import {
  BATAS_MEDIA,
  formatUkuran,
  siapkanMedia,
  type HasilMedia,
} from '@/lib/sosmed/media';

function TombolKirim({ label }: { label: string }) {
  const { sibuk, tandaiKirim } = useKirimForm();
  return (
    <button
      type="submit"
      disabled={sibuk}
      onClick={tandaiKirim}
      className="inline-flex items-center gap-2 rounded-lg bg-btn-biru-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-btn-biru-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {sibuk && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {label}
    </button>
  );
}

export function FormKonten({
  konten,
  calonPenyetuju,
  sayaId,
}: {
  konten?: {
    id: string;
    judul: string;
    caption: string;
    tujuan: string;
    jenis: string;
    mediaUrl: string | null;
    mediaByte: number | null;
    mediaLebar: number | null;
    mediaTinggi: number | null;
    durasiDetik: number | null;
    penyetujuId: string | null;
  };
  calonPenyetuju: { id: string; nama: string; nip: string; jabatan: string | null }[];
  sayaId: string;
}) {
  const [state, aksi] = useActionState(simpanKonten, {} as HasilAksi);
  const [stateHapus, aksiHapus] = useActionState(hapusMediaKonten, {} as HasilAksi);
  const [media, setMedia] = useState<HasilMedia | null>(null);
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [tujuan, setTujuan] = useState(konten?.tujuan ?? 'KEDUANYA');
  const [caption, setCaption] = useState(konten?.caption ?? '');
  const [adaBerkasLama, setAdaBerkasLama] = useState(Boolean(konten?.mediaUrl));
  const berkas = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const jenisTerpilih = media?.jenis ?? (konten?.jenis as 'GAMBAR' | 'VIDEO' | undefined) ?? null;
  const pratinjau = media?.dataUrl ?? (adaBerkasLama ? konten?.mediaUrl ?? null : null);

  // Setelah tersimpan, tarik ulang data dari server supaya tautan media yang
  // memuat penanda versi ikut berubah (kalau tidak, pratinjau menampilkan
  // salinan memori peramban terus).
  useEffect(() => {
    if (state.sukses || stateHapus.sukses) {
      setMedia(null);
      if (stateHapus.sukses) setAdaBerkasLama(false);
      router.refresh();
    }
  }, [state.sukses, stateHapus.sukses, router]);

  const pilih = async (f: File) => {
    setGalat(null);
    setProses(true);
    try {
      const hasil = await siapkanMedia(f);
      setMedia(hasil);
      setAdaBerkasLama(false);
      // TikTok tidak menerima gambar — koreksi tujuan otomatis + beri tahu.
      if (hasil.jenis === 'GAMBAR' && tujuan === 'TIKTOK') {
        setTujuan('INSTAGRAM');
        setGalat(
          'Gambar tidak bisa dikirim ke TikTok (TikTok hanya menerima video). Tujuan diubah ke Instagram saja.'
        );
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Berkas tidak dapat diproses.');
      setMedia(null);
    } finally {
      setProses(false);
    }
  };

  const captionTerlaluPanjang = caption.length > 2200;
  const kirimTidakLayak = !pratinjau || (jenisTerpilih === 'GAMBAR' && tujuan === 'TIKTOK');

  return (
    <div className="space-y-5">
      <form action={aksi} className="space-y-5">
        {konten?.id && <input type="hidden" name="id" value={konten.id} />}
        <input type="hidden" name="mediaData" value={media?.dataUrl ?? ''} />
        <input type="hidden" name="mediaMime" value={media?.mime ?? ''} />
        <input type="hidden" name="mediaByte" value={media?.byte ?? 0} />
        <input type="hidden" name="mediaLebar" value={media?.lebar ?? 0} />
        <input type="hidden" name="mediaTinggi" value={media?.tinggi ?? 0} />
        <input type="hidden" name="durasiDetik" value={media?.durasiDetik ?? 0} />
        <input type="hidden" name="jenis" value={jenisTerpilih ?? 'GAMBAR'} />

        {/* ===== 1. Berkas ===== */}
        <div className="kartu p-5">
          <h3 className="text-sm font-semibold text-abu-800 mb-1">1. Berkas konten</h3>
          <p className="text-xs text-abu-500 mb-4 leading-relaxed">
            Gambar dan video (MP4/MOV) hingga {formatUkuran(BATAS_MEDIA.videoMaksByte)}. Gambar
            dikecilkan & dikonversi ke JPEG otomatis di peramban sebelum dikirim — Instagram feed
            hanya menerima JPEG, jadi konversi ini yang membuat unggahan tidak ditolak.
          </p>

          <div className="flex flex-wrap gap-5">
            <div className="shrink-0">
              <div
                className="rounded-lg border-2 border-dashed border-abu-300 bg-abu-50 flex items-center justify-center overflow-hidden"
                style={{ width: '160px', height: '200px' }}
              >
                {proses ? (
                  <svg className="animate-spin h-6 w-6 text-abu-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : pratinjau ? (
                  jenisTerpilih === 'VIDEO' ? (
                    <video src={pratinjau} className="w-full h-full object-cover" controls />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pratinjau} alt="Pratinjau konten" className="w-full h-full object-cover" />
                  )
                ) : (
                  <span className="text-[11px] text-abu-400 text-center px-3">
                    Belum ada berkas
                  </span>
                )}
              </div>
              {media && (
                <p className="mt-1.5 text-[10px] text-abu-400 text-center tabular-nums">
                  {media.jenis === 'VIDEO' ? 'Video' : 'JPEG'} &middot; {media.lebar}&times;{media.tinggi}{' '}
                  &middot; {formatUkuran(media.byte)}
                  {media.durasiDetik ? ` · ${Math.round(media.durasiDetik)} dtk` : ''}
                </p>
              )}
              {!media && konten?.mediaUrl && konten.mediaByte && (
                <p className="mt-1.5 text-[10px] text-abu-400 text-center tabular-nums">
                  Berkas tersimpan &middot; {formatUkuran(konten.mediaByte)}
                  {konten.mediaLebar ? ` · ${konten.mediaLebar}×${konten.mediaTinggi}` : ''}
                </p>
              )}
            </div>

            <div className="flex-1 min-w-[240px] space-y-3">
              <input
                ref={berkas}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pilih(f);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => berkas.current?.click()}
                disabled={proses}
                className="rounded-lg border border-abu-300 bg-white px-3.5 py-2 text-xs font-medium text-abu-700 hover:bg-abu-50 disabled:opacity-60 transition-colors"
              >
                {pratinjau ? 'Ganti berkas' : 'Pilih berkas gambar / video'}
              </button>

              {galat && (
                <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5 leading-relaxed">
                  {galat}
                </p>
              )}
              {media && (
                <p className="text-[11px] text-sukses bg-sukses-bg rounded px-2.5 py-1.5">
                  Berkas siap dikirim ({formatUkuran(media.byte)}). Tekan Simpan di bawah.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ===== 2. Detail ===== */}
        <div className="kartu p-5 space-y-4">
          <h3 className="text-sm font-semibold text-abu-800">2. Judul & caption</h3>

          <div>
            <label htmlFor="judul" className="block text-xs font-medium text-abu-600 mb-1.5">
              Judul internal <span className="text-abu-400">(tidak ikut terkirim ke platform)</span>
            </label>
            <input
              id="judul"
              name="judul"
              required
              minLength={3}
              maxLength={120}
              defaultValue={konten?.judul ?? ''}
              placeholder="Mis. Promo KPR BTN edisi Oktober"
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="caption" className="block text-xs font-medium text-abu-600 mb-1.5">
              Caption / keterangan
            </label>
            <textarea
              id="caption"
              name="caption"
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tulis caption yang akan tampil di postingan…"
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none resize-y"
            />
            <p
              className={`mt-1 text-[11px] tabular-nums ${
                captionTerlaluPanjang ? 'text-bahaya font-semibold' : 'text-abu-400'
              }`}
            >
              {caption.length} / 2200 karakter (batas TikTok & Instagram)
              {captionTerlaluPanjang && ' — terlalu panjang, platform akan menolak'}
            </p>
          </div>
        </div>

        {/* ===== 3. Tujuan & penyetuju ===== */}
        <div className="kartu p-5 space-y-4">
          <h3 className="text-sm font-semibold text-abu-800">3. Tujuan & penyetuju</h3>

          <div>
            <span className="block text-xs font-medium text-abu-600 mb-2">Platform tujuan</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { nilai: 'KEDUANYA', label: 'TikTok & Instagram' },
                { nilai: 'TIKTOK', label: 'TikTok saja' },
                { nilai: 'INSTAGRAM', label: 'Instagram saja' },
              ].map((o) => {
                const mati = o.nilai === 'TIKTOK' && jenisTerpilih === 'GAMBAR';
                return (
                  <label
                    key={o.nilai}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs cursor-pointer transition-colors ${
                      tujuan === o.nilai
                        ? 'border-btn-biru-500 bg-btn-biru-50 font-semibold text-btn-biru-700'
                        : 'border-abu-300 bg-white text-abu-600 hover:bg-abu-50'
                    } ${mati ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="radio"
                      name="tujuan"
                      value={o.nilai}
                      checked={tujuan === o.nilai}
                      disabled={mati}
                      onChange={() => setTujuan(o.nilai)}
                      className="accent-btn-biru-600"
                    />
                    {o.label}
                  </label>
                );
              })}
            </div>
            {jenisTerpilih === 'GAMBAR' && (
              <p className="mt-2 text-[11px] text-peringatan">
                Berkas yang dipilih adalah gambar — TikTok tidak tersedia karena TikTok hanya
                menerima video.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="penyetujuId" className="block text-xs font-medium text-abu-600 mb-1.5">
              Penyetuju
            </label>
            <select
              id="penyetujuId"
              name="penyetujuId"
              defaultValue={konten?.penyetujuId ?? ''}
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm bg-white focus:border-btn-biru-500 focus:outline-none"
            >
              <option value="">— pilih penyetuju —</option>
              {calonPenyetuju
                .filter((p) => p.id !== sayaId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} · {p.jabatan ?? '—'}
                  </option>
                ))}
            </select>
            <p className="mt-1.5 text-[11px] text-abu-400 leading-relaxed">
              Penyetuju ditentukan di sini dan <strong>dikunci saat konten diajukan</strong> — draf
              tidak bisa diarahkan ulang ke penyetuju lain setelah dikirim untuk diperiksa.
            </p>
          </div>
        </div>

        {state.error && (
          <p className="text-xs text-bahaya bg-bahaya-bg rounded px-3 py-2">{state.error}</p>
        )}
        {state.sukses && (
          <p className="text-xs text-sukses bg-sukses-bg rounded px-3 py-2">{state.pesan}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <TombolKirim label={konten?.id ? 'Simpan perubahan' : 'Simpan sebagai draft'} />
          {pratinjau && (
            <span className="text-[11px] text-abu-400">
              Setelah tersimpan, konten masih bisa diajukan untuk disetujui.
            </span>
          )}
        </div>
      </form>

      {/* Hapus berkas dipisah: form bersarang tidak diperbolehkan HTML */}
      {adaBerkasLama && konten?.id && (
        <form action={aksiHapus} className="inline">
          <input type="hidden" name="id" value={konten.id} />
          <button type="submit" className="text-[11px] font-medium text-btn-merah-700 hover:underline">
            Hapus berkas yang tersimpan
          </button>
        </form>
      )}
      {stateHapus.error && (
        <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{stateHapus.error}</p>
      )}
      {stateHapus.sukses && (
        <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2.5 py-1.5">{stateHapus.pesan}</p>
      )}
    </div>
  );
}
