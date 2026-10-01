/**
 * Mengisi BENTUK (bukan sekadar gambar kotak) dengan foto, sehingga foto
 * mengikuti bentuk bentuknya — termasuk sudutnya yang membulat.
 *
 * Kenapa perlu: sebelumnya foto digambar sebagai `<p:pic>` dengan sudut
 * tajam, lalu ditimpa bingkai membulat. Karena sudut gambar kotak dan sudut
 * bingkai bulat tidak sama, keempat sudut kotak foto terlihat bolong.
 *
 * Cara yang benar di OOXML: bentuknya (`<p:sp>`) diberi `<a:blipFill>` berisi
 * gambar, bukan `<a:solidFill>`. PowerPoint lalu memotong gambar mengikuti
 * geometri bentuknya (`<a:prstGeom prst="roundRect">`).
 *
 * pptxgenjs belum mendukung ini, jadi slide dibangun dengan bentuk kosong
 * sebagai penanda, lalu bentuk itu ditukar menjadi blipFill setelah berkas
 * PPTX jadi. Pertukaran dilakukan per slide agar bisa memuat foto berbeda.
 */

import JSZip from 'jszip';
import type { Potongan } from './potong-gambar-pptx';

export type BentukBerfoto = {
  /** Nomor slide (1 = slide pertama). */
  slide: number;
  /** Nama bentuk di XML, mis. "FOTO_1" (dipakai sebagai penanda). */
  nama: string;
  /** Isi gambar dalam base64 (tanpa awalan data URL). */
  base64: string;
  /**
   * Jenis gambar untuk atribut content-type: 'jpeg' atau 'png'.
   * Dipakai agar PowerPoint tahu cara membacanya.
   */
  jenis: 'jpeg' | 'png';
  /** Bagian gambar yang dipakai (crop). Kosong = seluruh gambar. */
  potongan?: Potongan;
};

/** Ubah 0,125 -> "12500" (srcRect memakai 1/1000 persen). */
function keSeribuan(nilai: number | undefined): number {
  if (!nilai || nilai <= 0) return 0;
  return Math.round(Math.min(nilai, 0.9999) * 100000);
}

function srcRect(potongan: Potongan | undefined): string {
  if (!potongan) return '';
  const l = keSeribuan(potongan.kiri);
  const r = keSeribuan(potongan.kanan);
  const t = keSeribuan(potongan.atas);
  const b = keSeribuan(potongan.bawah);
  if (l === 0 && r === 0 && t === 0 && b === 0) return '';
  return `<a:srcRect l="${l}" r="${r}" t="${t}" b="${b}"/>`;
}

/**
 * Menukar bentuk bernama `nama` di slide tertentu menjadi bentuk yang
 * diisi gambar (blipFill), sehingga fotonya mengikuti bentuknya.
 *
 * @returns XML slide yang sudah disunting, dan daftar hubungan gambar (rId)
 *          yang perlu ditambahkan ke slide tersebut.
 */
export function isikanFotoKeBentuk(
  xmlSlide: string,
  nama: string,
  rId: string,
  potongan?: Potongan
): string {
  // Cari blok <p:sp> yang memuat bentuk bertanda nama tersebut.
  const polaSp = new RegExp(
    `<p:sp>(?:(?!</p:sp>)[\\s\\S])*?name="${nama}"(?:(?!</p:sp>)[\\s\\S])*?</p:sp>`
  );
  const cocok = xmlSlide.match(polaSp);
  if (!cocok) return xmlSlide;

  const sp = cocok[0];

  // Blok <p:spPr> berisi elemen yang BERsarANG (mis. <a:ln><a:solidFill/></a:ln>),
  // jadi tidak bisa memakai regex "sampai </p:spPr> pertama" — itu akan
  // berhenti di dalam. Yang benar: ambil isi spPr dengan menghitung
  // kedalaman tag.
  const mulaiSpPr = sp.indexOf('<p:spPr');
  if (mulaiSpPr < 0) return xmlSlide;

  let kedalaman = 0;
  let akhirSpPr = -1;
  const polaTag = /<(\/?)p:spPr[^>]*>/g;
  polaTag.lastIndex = mulaiSpPr;
  let t;
  while ((t = polaTag.exec(sp)) !== null) {
    if (t[1] === '/') {
      kedalaman -= 1;
      if (kedalaman === 0) {
        akhirSpPr = t.index + t[0].length;
        break;
      }
    } else {
      kedalaman += 1;
    }
  }
  if (akhirSpPr < 0) return xmlSlide;

  const blipFill =
    `<p:blipFill><a:blip r:embed="${rId}"></a:blip>${srcRect(potongan)}` +
    `<a:stretch><a:fillRect/></a:stretch></p:blipFill>`;

  // blipFill harus berada SETELAH </p:spPr> dan SEBELUM <p:style>/<p:txBody>,
  // karena itu urutan yang diwajibkan skema OOXML. Jadi disisipkan tepat
  // setelah penutup spPr, bukan di dalamnya.
  const spBaru = sp.slice(0, akhirSpPr) + blipFill + sp.slice(akhirSpPr);

  return xmlSlide.replace(sp, spBaru);
}

/** Menambahkan entri gambar ke daftar relasi slide. */
export function tambahRelasiGambar(
  xmlRel: string,
  rId: string,
  namaBerkas: string
): string {
  const rel =
    `<Relationship Id="${rId}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
    `Target="../media/${namaBerkas}"/>`;
  return xmlRel.replace('</Relationships>', `${rel}</Relationships>`);
}

/**
 * Menerapkan seluruh foto ke bentuknya masing-masing di dalam berkas PPTX.
 */
export async function isikanFotoKeBentukPptx(
  berkasPptx: Buffer,
  daftar: BentukBerfoto[]
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(berkasPptx);

  // Kelompokkan per slide supaya berkas relasinya dibuka sekali saja.
  const perSlide = new Map<number, BentukBerfoto[]>();
  for (const b of daftar) {
    const arr = perSlide.get(b.slide) ?? [];
    arr.push(b);
    perSlide.set(b.slide, arr);
  }

  for (const [nomor, bentuk] of perSlide) {
    const namaSlide = `ppt/slides/slide${nomor}.xml`;
    const namaRel = `ppt/slides/_rels/slide${nomor}.xml.rels`;

    let xml = await zip.file(namaSlide)!.async('string');
    let xmlRel = await zip.file(namaRel)!.async('string');

    // cari nomor rId terbesar yang sudah ada supaya tidak bertabrakan
    const rIdAda = [...xmlRel.matchAll(/Id="rId(\d+)"/g)].map((m) =>
      Number(m[1])
    );
    let rIdMax = rIdAda.length ? Math.max(...rIdAda) : 0;

    // cari nomor berkas media terbesar
    const mediaAda = Object.keys(zip.files)
      .filter((f) => f.startsWith('ppt/media/'))
      .map((f) => Number(f.match(/image(\d+)\./)?.[1] ?? 0));
    let mediaMax = mediaAda.length ? Math.max(...mediaAda) : 0;

    for (const b of bentuk) {
      rIdMax += 1;
      mediaMax += 1;
      const rId = `rId${rIdMax}`;
      const namaBerkas = `image${mediaMax}.${b.jenis}`;

      zip.file(`ppt/media/${namaBerkas}`, Buffer.from(b.base64, 'base64'));
      xmlRel = tambahRelasiGambar(xmlRel, rId, namaBerkas);
      xml = isikanFotoKeBentuk(xml, b.nama, rId, b.potongan);
    }

    zip.file(namaSlide, xml);
    zip.file(namaRel, xmlRel);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}
