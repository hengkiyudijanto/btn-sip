/**
 * Membuat slide uji berisi 4 petugas (semua jabatan digabung) supaya jarak
 * antar kotak foto benar-benar terlihat, sekaligus bayangannya.
 */

import { writeFileSync } from 'node:fs';
import { prisma } from '@/lib/db';
import { susunRanking } from '@/lib/sip/ranking';
import { bangunPptxRanking } from '@/lib/sip/ranking-pptx';
import { siapkanFotoUntukKotak } from '@/lib/sip/foto-bulat';

async function main() {
  const periode = await prisma.periode.findFirst({
    where: { penilaian: { some: { nilaiAkhir: { not: null } } } },
  });
  if (!periode) throw new Error('tidak ada periode dengan penilaian');

  // Tanpa filter jabatan -> semua petugas masuk satu slide
  const hasil = await susunRanking({ periodeId: periode.id });
  console.log(`peserta: ${hasil.jumlahPeserta}, kelompok: ${hasil.kelompok.length}`);
  for (const k of hasil.kelompok) {
    console.log(`  ${k.unit} / ${k.posisi}: ${k.baris.length} baris`);
  }

  const pen = await prisma.penilaian.findMany({
    where: { periodeId: periode.id, nilaiAkhir: { not: null } },
    select: { fotoData: true, pegawai: { select: { nip: true } } },
  });

  const petaFoto = new Map<string, string>();
  for (const p of pen) {
    if (!p.fotoData) continue;
    const koma = p.fotoData.indexOf(',');
    if (koma <= 0) continue;
    const asli = Buffer.from(p.fotoData.slice(koma + 1), 'base64');
    const siap = await siapkanFotoUntukKotak(asli);
    petaFoto.set(p.pegawai.nip, (siap ?? asli).toString('base64'));
  }
  console.log(`foto tersedia: ${petaFoto.size}`);

  const buf = await bangunPptxRanking(hasil, petaFoto);
  writeFileSync('/home/ubuntu/projects/btn-sip/uji-jarak.pptx', buf);
  console.log('ditulis: uji-jarak.pptx');

  await prisma.$disconnect();
}

main();
