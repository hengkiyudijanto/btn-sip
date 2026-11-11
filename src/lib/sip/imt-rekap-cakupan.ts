import { kumpulkanTurunan } from './hierarki';

type CabangIdRingkas = { id: string; indukId: string | null };

type MasukanCakupanIMT = {
  bolehSemua: boolean;
  cabangPenggunaId: string;
  cabangDimintaId: string | null;
  pohon: CabangIdRingkas[];
};

/** Bentuk cakupan cabang dari identitas terautentikasi dan filter yang divalidasi. */
export function cakupanCabangRekapIMT({ bolehSemua, cabangPenggunaId, cabangDimintaId, pohon }: MasukanCakupanIMT): string[] | null {
  if (!bolehSemua) return kumpulkanTurunan(cabangPenggunaId, pohon);
  if (!cabangDimintaId) return null;
  if (!pohon.some((c) => c.id === cabangDimintaId)) return [];
  return kumpulkanTurunan(cabangDimintaId, pohon);
}
