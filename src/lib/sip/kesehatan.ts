export function hitungBMI(beratKg: number | null, tinggiCm: number | null): number | null {
  if (beratKg == null || tinggiCm == null || beratKg <= 0 || tinggiCm <= 0) return null;
  return Math.round((beratKg / ((tinggiCm / 100) ** 2)) * 10) / 10;
}

export function kategoriBMI(bmi: number): 'Kurus' | 'Normal' | 'Berlebih' | 'Obesitas' {
  if (bmi < 18.5) return 'Kurus';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Berlebih';
  return 'Obesitas';
}
