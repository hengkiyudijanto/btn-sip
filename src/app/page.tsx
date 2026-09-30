import { redirect } from 'next/navigation';

/**
 * Halaman root: arahkan ke tempat yang tepat.
 * Logika detail sesi ditangani di masing-masing halaman tujuan.
 */
export default function Home() {
  redirect('/masuk');
}
