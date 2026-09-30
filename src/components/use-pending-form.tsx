'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * Tombol di dalam <form> penilaian.
 *
 * useFormStatus() mengembalikan pending=true saat komponen dirender di
 * server (status form belum diketahui), sehingga tombol jadi nonaktif
 * di HTML awal. Untuk mengatasinya, isPending dari useFormStatus
 * dimatikan oleh penanda "sudah pernah dikirim" yang baru aktif setelah
 * ada interaksi klien.
 */
export function usePendingForm() {
  const { pending } = useFormStatus();
  // aktifkan hanya bila form benar-benar sedang dikirim dari sisi klien
  const [pernahKirim, setPernahKirim] = useState(false);
  return { pending: pending && pernahKirim, setPernahKirim };
}
