/**
 * Uji penghitungan penempatan foto.
 *
 * Tujuan: foto SELALU memenuhi kotak dan proporsinya tidak gepeng, apa pun
 * rasio foto aslinya.
 */

import { describe, expect, it } from 'vitest';
import { hitungPenempatanFoto, rasioDariBuffer } from './potong-foto';

const KOTAK = { x: 10, y: 20, w: 1.2, h: 1.0 };   // rasio kotak 1,2

describe('hitungPenempatanFoto', () => {
  it('foto lebih lebar: tinggi pas kotak, lebar berlebih', () => {
    const t = hitungPenempatanFoto(KOTAK, 2.0);   // rasio foto 2,0 > 1,2
    expect(t.h).toBeCloseTo(KOTAK.h, 6);
    expect(t.w).toBeCloseTo(KOTAK.h * 2.0, 6);
    expect(t.w).toBeGreaterThan(KOTAK.w);
  });

  it('foto lebih tinggi: lebar pas kotak, tinggi berlebih', () => {
    const t = hitungPenempatanFoto(KOTAK, 0.75);  // rasio foto 0,75 < 1,2
    expect(t.w).toBeCloseTo(KOTAK.w, 6);
    expect(t.h).toBeCloseTo(KOTAK.w / 0.75, 6);
    expect(t.h).toBeGreaterThan(KOTAK.h);
  });

  it('foto selalu MENUTUPI kotak (tidak ada bagian kosong)', () => {
    for (const rasio of [0.5, 0.75, 1.0, 1.2, 1.5, 2.0, 3.0]) {
      const t = hitungPenempatanFoto(KOTAK, rasio);
      expect(t.w).toBeGreaterThanOrEqual(KOTAK.w - 1e-9);
      expect(t.h).toBeGreaterThanOrEqual(KOTAK.h - 1e-9);
    }
  });

  it('proporsi foto TIDAK berubah (skala x = skala y)', () => {
    for (const rasio of [0.5, 0.75, 1.0, 1.5, 2.0]) {
      const t = hitungPenempatanFoto(KOTAK, rasio);
      // rasio gambar hasil harus sama dengan rasio foto aslinya
      expect(t.w / t.h).toBeCloseTo(rasio, 6);
    }
  });

  it('gambar dipusatkan pada kotak', () => {
    const t = hitungPenempatanFoto(KOTAK, 2.0);
    const pusatGambarX = t.x + t.w / 2;
    const pusatKotakX = KOTAK.x + KOTAK.w / 2;
    expect(pusatGambarX).toBeCloseTo(pusatKotakX, 6);

    const pusatGambarY = t.y + t.h / 2;
    const pusatKotakY = KOTAK.y + KOTAK.h / 2;
    expect(pusatGambarY).toBeCloseTo(pusatKotakY, 6);
  });

  it('foto dengan rasio sama persis dengan kotak: tanpa potongan', () => {
    const t = hitungPenempatanFoto(KOTAK, KOTAK.w / KOTAK.h);
    expect(t.w).toBeCloseTo(KOTAK.w, 6);
    expect(t.h).toBeCloseTo(KOTAK.h, 6);
    expect(t.potongKiri).toBeCloseTo(0, 6);
    expect(t.potongAtas).toBeCloseTo(0, 6);
  });

  it('potongan terbagi rata kiri-kanan', () => {
    const t = hitungPenempatanFoto(KOTAK, 2.0);
    expect(t.potongKiri).toBeCloseTo(t.potongKanan, 6);
    expect(t.potongKiri).toBeGreaterThan(0);
  });

  it('potongan terbagi rata atas-bawah', () => {
    const t = hitungPenempatanFoto(KOTAK, 0.75);
    expect(t.potongAtas).toBeCloseTo(t.potongBawah, 6);
    expect(t.potongAtas).toBeGreaterThan(0);
  });

  it('rasio tidak valid: taruh memenuhi kotak apa adanya', () => {
    for (const buruk of [0, -1, NaN, Infinity]) {
      const t = hitungPenempatanFoto(KOTAK, buruk);
      expect(t.x).toBe(KOTAK.x);
      expect(t.y).toBe(KOTAK.y);
      expect(t.w).toBe(KOTAK.w);
      expect(t.h).toBe(KOTAK.h);
    }
  });
});

describe('rasioDariBuffer (baca ukuran JPEG)', () => {
  /** Membuat buffer JPEG minimal dengan SOF0 berisi ukuran tertentu. */
  function jpegPalsu(lebar: number, tinggi: number): Uint8Array {
    const b = new Uint8Array([
      0xff, 0xd8,                     // SOI
      0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,  // APP0 panjang 4
      0xff, 0xc0, 0x00, 0x11, 0x08,   // SOF0 panjang 17, presisi 8
      (tinggi >> 8) & 0xff, tinggi & 0xff,
      (lebar >> 8) & 0xff, lebar & 0xff,
      0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
      0xff, 0xd9,                     // EOI
    ]);
    return b;
  }

  it('membaca rasio dari JPEG potret', () => {
    expect(rasioDariBuffer(jpegPalsu(300, 400))).toBeCloseTo(0.75, 6);
  });

  it('membaca rasio dari JPEG lanskap', () => {
    expect(rasioDariBuffer(jpegPalsu(1200, 600))).toBeCloseTo(2.0, 6);
  });

  it('bukan JPEG: kembalikan null', () => {
    expect(rasioDariBuffer(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });

  it('buffer terlalu pendek: kembalikan null', () => {
    expect(rasioDariBuffer(new Uint8Array([0xff]))).toBeNull();
  });
});
