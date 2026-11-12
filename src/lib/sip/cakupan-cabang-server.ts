import { prisma } from '@/lib/db';
import { boleh } from '@/lib/sip/akses';
import { kumpulkanTurunan } from './hierarki';

/** Scope data by the signed-in role's branch level; cross-branch capability remains explicit. */
export async function cakupanCabangUntukPegawai(saya: { role: string; cabang: { id: string } }): Promise<string[] | undefined> {
  if (boleh(saya.role, 'lihat_semua_cabang')) return undefined;
  const cabang = await prisma.cabang.findMany({ select: { id: true, indukId: true } });
  if (saya.role === 'MANAGER' || saya.role === 'SUPERVISOR') return kumpulkanTurunan(saya.cabang.id, cabang);
  return [saya.cabang.id];
}
