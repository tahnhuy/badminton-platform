/**
 * Canonical province/city names used by facility statistics and filters.
 *
 * Owner-entered text can vary ("TP. Hồ Chí Minh", "Hồ Chí Minh", "HCM"), so the
 * statistics and the city filter share one mapping instead of each applying its
 * own matching logic (plan 4.2, decision 9).
 */
export const CANONICAL_CITIES = [
  'Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Bà Rịa - Vũng Tàu',
  'Khánh Hòa',
  'Lâm Đồng',
  'Thừa Thiên Huế',
  'Quảng Ninh',
] as const;

const CITY_ALIASES: Record<string, string> = {
  'hồ chí minh': 'Hồ Chí Minh',
  'ho chi minh': 'Hồ Chí Minh',
  hcm: 'Hồ Chí Minh',
  'tp hcm': 'Hồ Chí Minh',
  'tp. hcm': 'Hồ Chí Minh',
  'tp hồ chí minh': 'Hồ Chí Minh',
  'tp. hồ chí minh': 'Hồ Chí Minh',
  'thành phố hồ chí minh': 'Hồ Chí Minh',
  saigon: 'Hồ Chí Minh',
  'sài gòn': 'Hồ Chí Minh',
  'hà nội': 'Hà Nội',
  'ha noi': 'Hà Nội',
  hn: 'Hà Nội',
  'tp hà nội': 'Hà Nội',
  'tp. hà nội': 'Hà Nội',
  'đà nẵng': 'Đà Nẵng',
  'da nang': 'Đà Nẵng',
  'cần thơ': 'Cần Thơ',
  'can tho': 'Cần Thơ',
  'hải phòng': 'Hải Phòng',
  'hai phong': 'Hải Phòng',
  'bình dương': 'Bình Dương',
  'binh duong': 'Bình Dương',
  'đồng nai': 'Đồng Nai',
  'dong nai': 'Đồng Nai',
  'bà rịa - vũng tàu': 'Bà Rịa - Vũng Tàu',
  'bà rịa vũng tàu': 'Bà Rịa - Vũng Tàu',
  'vũng tàu': 'Bà Rịa - Vũng Tàu',
  'khánh hòa': 'Khánh Hòa',
  'khanh hoa': 'Khánh Hòa',
  'lâm đồng': 'Lâm Đồng',
  'lam dong': 'Lâm Đồng',
  'thừa thiên huế': 'Thừa Thiên Huế',
  'thua thien hue': 'Thừa Thiên Huế',
  huế: 'Thừa Thiên Huế',
  'quảng ninh': 'Quảng Ninh',
  'quang ninh': 'Quảng Ninh',
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Returns the canonical city name, or the trimmed input when it is not mapped.
 * Unknown names are kept as-is rather than dropped so statistics stay honest.
 */
export function normalizeCityName(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  return CITY_ALIASES[normalizeKey(trimmed)] ?? trimmed;
}

/** True when a stored city belongs to the requested canonical/alias value. */
export function cityMatches(stored: string | null | undefined, requested: string): boolean {
  const target = normalizeCityName(requested);
  if (!target) return false;
  return normalizeCityName(stored) === target;
}

/**
 * Stored-city LIKE patterns for a requested city, covering canonical name and
 * known aliases. Used by the Admin facility city filter.
 */
export function cityFilterPatterns(requested: string): string[] {
  const canonical = normalizeCityName(requested);
  if (!canonical) return [];
  const aliases = Object.entries(CITY_ALIASES)
    .filter(([, mapped]) => mapped === canonical)
    .map(([alias]) => alias);
  const unique = new Set([canonical.toLowerCase(), ...aliases]);
  // Escape LIKE wildcards so free-text input such as "%" or "_" cannot match every city.
  return [...unique].map((value) => `%${value.replace(/[\\%_]/g, '\\$&')}%`);
}
