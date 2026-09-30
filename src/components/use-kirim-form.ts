'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Status "sedang dikirim" untuk tombol di dalam <form> server action.
 *
 * Kenapa perlu hook ini?
 * ---------------------------------------------
 * useFormStatus() mengembalikan `pending: true` saat komponen dirender di
 * SERVER, karena status form belum diketahui pada saat itu. Akibatnya
 * tombol `<button disabled={pending}>` tercetak NONAKTIF di HTML awal,
 * dan pengguna melihat semua tombol mati sebelum halaman hidup —
 * walau tidak ada yang sedang dikirim.
 *
 * Hook ini hanya mempercayai nilai pending setelah tombol benar-benar
 * diklik di peramban. Jadi:
 *   - HTML awal  : disabled = false  (tombol bisa diklik)
 *   - saat dikirim: disabled = true  (mencegah klik ganda)
 *   - setelah selesai: disabled = false lagi
 *
 * Pemakaian:
 *   const { sibuk, tandaiKirim } = useKirimForm();
 *   <button type="submit" disabled={sibuk} onClick={tandaiKirim}>
 */
export function useKirimForm() {
  const { pending } = useFormStatus();
  const [pernahDikirim, setPernahDikirim] = useState(false);

  return {
    /** true hanya bila form benar-benar sedang dikirim dari peramban */
    sibuk: pernahDikirim && pending,
    /** pasang di onClick tombol submit */
    tandaiKirim: () => setPernahDikirim(true),
  };
}
