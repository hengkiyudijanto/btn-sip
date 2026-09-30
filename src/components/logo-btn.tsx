import Image from 'next/image';

/**
 * Logo Bank BTN.
 * File: public/btn-logo.png — huruf "btn" biru dengan aksen merah.
 */
export function LogoBTN({
  tinggi = 32,
  className = '',
}: {
  tinggi?: number;
  className?: string;
}) {
  return (
    <Image
      src="/btn-logo.png"
      alt="Bank BTN"
      height={tinggi}
      width={Math.round(tinggi * 1.6)}
      priority
      className={`object-contain ${className}`}
    />
  );
}
