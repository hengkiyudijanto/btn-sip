/** Intersect requested ranking filter IDs with the caller's authorized branch IDs.
 * Undefined authorized IDs means the caller has intentional cross-branch access.
 */
export function batasiCakupanCabangRanking(
  cabangDimintaIds: string[] | undefined,
  cabangDiizinkanIds: string[] | undefined,
): string[] | undefined {
  if (cabangDiizinkanIds === undefined) return cabangDimintaIds;
  if (cabangDimintaIds === undefined) return cabangDiizinkanIds;
  const diizinkan = new Set(cabangDiizinkanIds);
  return cabangDimintaIds.filter((id) => diizinkan.has(id));
}
