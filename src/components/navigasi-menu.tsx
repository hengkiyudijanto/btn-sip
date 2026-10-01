'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Menu navigasi dengan submenu.
 *
 * Submenu dibuka dengan KLIK (bukan hanya hover) supaya tetap bisa dipakai
 * di layar sentuh. Yang penting: sebuah menu induk dianggap "aktif" kalau
 * alamat halaman saat ini berada di dalam salah satu submenunya — jadi
 * pengguna tahu sedang di mana.
 *
 * Ditutup kalau: klik di luar, atau tekan Escape.
 */

export type SubItem = { href: string; label: string };

export type ItemMenuNav = {
  href?: string;
  label: string;
  anak?: SubItem[];
};

export function NavigasiMenu({ menu }: { menu: ItemMenuNav[] }) {
  const pathname = usePathname();
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const wadah = useRef<HTMLDivElement>(null);

  // tutup kalau klik di luar menu
  useEffect(() => {
    function padaKlikLuar(e: MouseEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) {
        setTerbuka(null);
      }
    }
    function padaEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setTerbuka(null);
    }
    document.addEventListener('mousedown', padaKlikLuar);
    document.addEventListener('keydown', padaEscape);
    return () => {
      document.removeEventListener('mousedown', padaKlikLuar);
      document.removeEventListener('keydown', padaEscape);
    };
  }, []);

  // tutup submenu setiap kali pindah halaman
  useEffect(() => {
    setTerbuka(null);
  }, [pathname]);

  /** Apakah halaman ini berada di dalam menu (induk atau salah satu anak)? */
  function sedangDiSini(m: ItemMenuNav): boolean {
    if (m.href && pathname === m.href) return true;
    if (m.anak) {
      return m.anak.some(
        (a) => pathname === a.href || pathname.startsWith(a.href + '/')
      );
    }
    return Boolean(m.href && pathname.startsWith(m.href + '/'));
  }

  return (
    <nav ref={wadah} className="hidden md:flex items-center gap-1">
      {menu.map((m) => {
        const adaAnak = Boolean(m.anak?.length);
        const aktif = sedangDiSini(m);
        const buka = terbuka === m.label;

        // menu tanpa submenu: tautan biasa
        if (!adaAnak) {
          return (
            <Link
              key={m.label}
              href={m.href ?? '#'}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                aktif
                  ? 'bg-white/15 text-white'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {m.label}
            </Link>
          );
        }

        // menu dengan submenu: tombol buka/tutup + daftar anak
        return (
          <div key={m.label} className="relative">
            <button
              type="button"
              onClick={() => setTerbuka(buka ? null : m.label)}
              aria-expanded={buka}
              aria-haspopup="true"
              className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                aktif || buka
                  ? 'bg-white/15 text-white'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {m.label}
              <svg
                className={`h-3 w-3 transition-transform ${buka ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {buka && (
              <div className="absolute left-0 top-full mt-1 min-w-[210px] rounded-lg border border-abu-200 bg-white py-1.5 shadow-lg">
                {m.anak!.map((a) => {
                  const anakAktif =
                    pathname === a.href || pathname.startsWith(a.href + '/');
                  return (
                    <Link
                      key={a.href}
                      href={a.href}
                      className={`block px-3.5 py-2 text-sm transition-colors ${
                        anakAktif
                          ? 'bg-btn-biru-50 font-medium text-btn-biru-700'
                          : 'text-abu-700 hover:bg-abu-50'
                      }`}
                    >
                      {a.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Versi ringkas untuk layar kecil: submenu ditampilkan sebagai baris kedua. */
export function MenuMobile({ menu }: { menu: ItemMenuNav[] }) {
  const pathname = usePathname();

  function sedangDiSini(href: string): boolean {
    return pathname === href || pathname.startsWith(href + '/');
  }

  // di layar kecil, semua item (induk + anak) ditampilkan dalam satu deretan
  // yang bisa digeser — lebih sederhana daripada submenu bertingkat.
  const datar: SubItem[] = [];
  for (const m of menu) {
    if (m.anak?.length) {
      // induk dengan submenu: kalau punya halaman sendiri, tampilkan juga
      if (m.href) datar.push({ href: m.href, label: m.label });
      for (const a of m.anak) datar.push(a);
    } else if (m.href) {
      datar.push({ href: m.href, label: m.label });
    }
  }

  return (
    <nav className="md:hidden flex overflow-x-auto border-t border-white/10">
      {datar.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className={`shrink-0 px-4 py-2.5 text-xs font-medium transition-colors ${
            sedangDiSini(m.href)
              ? 'bg-white/15 text-white'
              : 'text-white/75 hover:text-white hover:bg-white/10'
          }`}
        >
          {m.label}
        </Link>
      ))}
    </nav>
  );
}
