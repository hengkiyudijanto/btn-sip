/** Menelusuri kenapa relasi bersarang tidak ikut dirapikan. */

import { prisma } from '@/lib/db';
import { rapikanHasil } from '@/lib/rapikan-data';

async function main() {
  // 1. query langsung model Pegawai -> dirapikan
  const a = await prisma.pegawai.findFirst({
    where: { nip: '21806' },
    select: { nama: true },
  });
  console.log('1. pegawai.findFirst        :', JSON.stringify(a));

  // 2. query lewat relasi -> tidak dirapikan?
  const b = await prisma.penilaian.findFirst({
    where: { pegawai: { nip: '21806' } },
    select: { pegawai: { select: { nama: true } } },
  });
  console.log('2. penilaian -> pegawai     :', JSON.stringify(b));

  // 3. apa yang dikembalikan query SEBELUM dirapikan?
  //    Panggil rapikanHasil manual untuk melihat perilakunya
  const mentah = { pegawai: { nama: 'MARINA KADIR' } };
  console.log('3. rapikanHasil(mentah)     :', JSON.stringify(rapikanHasil(mentah, 'Penilaian', new Set(['Cabang']))));

  // 4. rapikanHasil pada bentuk array
  const mentahArr = [{ pegawai: { nama: 'HUSNIA PARADITHA' } }, { pegawai: { nama: 'Irwan Allo' } }];
  console.log('4. rapikanHasil(array)      :', JSON.stringify(rapikanHasil(mentahArr, 'Penilaian', new Set(['Cabang']))));

  // 5. dengan field lain yang bukan objek
  const mentahLengkap = {
    id: 'x1', nilaiAkhir: 4.31, fotoData: 'data:image/jpeg;base64,AAA',
    pegawai: { nip: '21806', nama: 'MARINA KADIR' },
  };
  console.log('5. rapikanHasil(lengkap)    :', JSON.stringify(rapikanHasil(mentahLengkap, 'Penilaian', new Set(['Cabang']))));

  await prisma.$disconnect();
}

main();
