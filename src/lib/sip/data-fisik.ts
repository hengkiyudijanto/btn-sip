export function validasiDataFisikPegawai(
  role: string,
  tanggalLahir: string,
  tinggiBadan: string
): string | null {
  if (role === 'PEGAWAI' && !tanggalLahir) return 'Tanggal lahir wajib diisi untuk peran Pegawai.';
  if (role === 'PEGAWAI' && !tinggiBadan) return 'Tinggi badan wajib diisi untuk peran Pegawai.';
  if (tanggalLahir) {
    const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalLahir);
    const tanggal = cocok ? new Date(`${tanggalLahir}T00:00:00.000Z`) : null;
    const valid = tanggal && !Number.isNaN(tanggal.getTime()) && tanggal.toISOString().slice(0, 10) === tanggalLahir;
    if (!valid) return 'Tanggal lahir tidak valid.';
  }
  if (tinggiBadan) {
    const nilai = Number(tinggiBadan);
    if (!Number.isFinite(nilai) || nilai <= 0) return 'Tinggi badan harus lebih besar dari 0.';
  }
  return null;
}
