import { readFileSync, writeFileSync } from 'node:fs';


/**
 * Ganti pola "const { pending } = useFormStatus()" + disabled={pending}
 * dengan hook useKirimForm() yang tidak menonaktifkan tombol di HTML awal.
 *
 * Hanya menyentuh komponen di src/components (semuanya berkas klien).
 */

const berkas = [
  'src/components/aksi-persetujuan.tsx',
  'src/components/form-masuk.tsx',
  'src/components/form-penilaian.tsx',
  'src/components/form-ubah-password.tsx',
  'src/components/foto-penilaian.tsx',
  'src/components/kelola-cabang.tsx',
  'src/components/kelola-pegawai.tsx',
  'src/components/kelola-pengajuan.tsx',
  'src/components/kelola-periode.tsx',
  'src/components/panel-hari-penilaian.tsx',
];

for (const f of berkas) {
  let s;
  try {
    s = readFileSync(f, 'utf8');
  } catch {
    console.log(`LEWAT (tidak ada): ${f}`);
    continue;
  }

  const asli = s;
  let diubah = false;

  // 1. ganti import useFormStatus -> useKirimForm
  if (s.includes("import { useFormStatus } from 'react-dom';")) {
    s = s.replace(
      "import { useFormStatus } from 'react-dom';",
      "import { useKirimForm } from '@/components/use-kirim-form';"
    );
    diubah = true;
  }

  // 2. ganti pemanggilan hook
  //    "const { pending } = useFormStatus();" -> pakai hook baru
  const polaHook = /const \{ pending \} = useFormStatus\(\);/g;
  if (polaHook.test(s)) {
    s = s.replace(polaHook, 'const { sibuk: pending, tandaiKirim } = useKirimForm();');
    diubah = true;
  }

  // 3. tambahkan onClick={tandaiKirim} pada tombol yang punya disabled={pending}
  //    tangani beberapa bentuk penulisan
  const bentuk = [
    'disabled={pending}',
    'disabled={pending || nonaktif}',
  ];
  for (const b of bentuk) {
    if (s.includes(b) && !s.includes('tandaiKirim}')) {
      s = s.replace(
        new RegExp(b.replace(/[{}|]/g, '\\$&'), 'g'),
        `${b}\n      onClick={tandaiKirim}`
      );
      diubah = true;
    }
  }

  if (diubah && s !== asli) {
    writeFileSync(f, s);
    console.log(`DIPERBARUI: ${f}`);
  } else {
    console.log(`tidak berubah: ${f}`);
  }
}

console.log('\nselesai');
