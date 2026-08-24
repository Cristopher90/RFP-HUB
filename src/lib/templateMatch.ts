export function matchesTemplate(
  template: { matchCommodity: string | null; matchRegion: string | null },
  commodity: string,
  region: string,
) {
  const commodityOk =
    !template.matchCommodity ||
    template.matchCommodity.trim().toLowerCase() ===
      commodity.trim().toLowerCase();
  const regionOk =
    !template.matchRegion ||
    template.matchRegion.trim().toLowerCase() === region.trim().toLowerCase();
  return commodityOk && regionOk;
}
