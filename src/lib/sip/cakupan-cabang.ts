import { kumpulkanTurunan } from './hierarki';

type CabangId = { id: string; indukId: string | null };

export function cakupanCabangHierarkis(cabangId: string, pohon: CabangId[]): string[] {
  return kumpulkanTurunan(cabangId, pohon);
}
