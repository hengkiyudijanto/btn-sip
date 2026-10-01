/**
 * Alamat foto untuk ditampilkan lewat route /foto, bukan sebagai data URL.
 *
 * Kenapa tidak langsung memakai data URL: data URL ikut terkirim di setiap
 * pembukaan halaman. Dengan alamat tersendiri, browser menyimpan foto di
 * cache dan hanya mengunduhnya sekali — halaman terasa jauh lebih cepat
 * tanpa mengubah kualitas foto sedikit pun.
 *
 * PENTING — penanda versi:
 * Foto punya URL tetap per penilaian, jadi kalau atasan mengganti foto,
 * browser bisa menyajikan foto LAMA dari cache. Karena itu alamat selalu
 * disertai `?v=<cap waktu>` dari kolom fotoDiperbarui. Selama fotonya tidak
 * berubah, alamatnya tetap (cache bekerja); begitu berganti, alamatnya
 * berubah juga (foto baru langsung tampil).
 */

type SumberFoto = {
  id: string;
  fotoData: string | null;
  fotoDiperbarui?: Date | null;
};

/** Data URL yang sudah ada di database, atau null bila tidak ada foto. */
function sebagaiDataUrl(foto: string | null): string | null {
  if (!foto) return null;
  // Kolom lama bisa berisi URL dari server lain (mis. fotoUrl pegawai)
  if (!foto.startsWith('data:')) return foto;
  return foto;
}

/** Alamat route gambar dengan penanda versi, atau null bila tidak ada foto. */
export function alamatFoto(
  jenis: 'penilaian' | 'pegawai',
  sumber: SumberFoto
): string | null {
  const isi = sumber.fotoData;
  if (!isi) return null;

  // Foto dari URL luar (bukan unggahan) dipakai langsung — tidak ada gunanya
  // dilewatkan route sendiri, dan URL-nya sudah punya cache sendiri.
  if (!isi.startsWith('data:')) return isi;

  const versi = sumber.fotoDiperbarui
    ? sumber.fotoDiperbarui.getTime().toString(36)
    : '1';
  return `/foto/${jenis}/${sumber.id}?v=${versi}`;
}

export { sebagaiDataUrl };
