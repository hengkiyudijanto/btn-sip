/**
 * Logo aplikasi: tulisan "SIP" biasa — tanpa gambar, tanpa aksen.
 *
 * Sengaja hanya teks: bentuknya mengikuti font sistem (sans-serif tebal, spasi
 * rapat), dan warnanya mewarisi `currentColor` sehingga otomatis putih di
 * sidebar gelap dan biru di halaman terang.
 */
export function LogoSIP({
  tinggi = 32,
  className = '',
}: {
  /** Tinggi huruf dalam px. */
  tinggi?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="SIP"
      className={`font-extrabold uppercase leading-none ${className}`}
      style={{ fontSize: tinggi, letterSpacing: '-0.02em' }}
    >
      SIP
    </span>
  );
}
