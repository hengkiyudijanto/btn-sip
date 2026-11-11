type PesertaFotoRanking = { nip: string; fotoPenilaian: string | null; fotoProfil: string | null };
type PesertaRanking = { nip: string };

export function nipDalamRanking(peserta: PesertaRanking[]): string[] {
  return [...new Set(peserta.map((p) => p.nip))];
}

/** Build the PPTX photo map from the ranking roster, preferring assessment photo then profile photo. */
export function fotoUntukRankingPptx(nips: string[], peserta: PesertaFotoRanking[]): Map<string, string> {
  const nipTerpilih = new Set(nips);
  const hasil = new Map<string, string>();
  for (const p of peserta) {
    if (!nipTerpilih.has(p.nip)) continue;
    const foto = p.fotoPenilaian ?? p.fotoProfil;
    if (foto) hasil.set(p.nip, foto);
  }
  return hasil;
}
