export function normalizeName(name: string): string {
  return name
    .normalize('NFD').replace(/\p{M}/gu, '')      // strip accents
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?[\s-]*(?:to\s+\d+(\.\d+)?[\s-]*)?(?:fl\.?[\s-]*)?(?:oz|lb|lbs|ct|liter|litre|l|ml|g|kg|pk|pkg|pack)\b\.?/g, ' ')
    .replace(/\b(any variety|assorted|selected varieties|select varieties|tray pack)\b/g, ' ')
    .replace(/\b(pkg|pack|pk)\b\.?/g, ' ')
    .replace(/[*,.!()]/g, ' ')
    .replace(/[-–]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function slugify(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
