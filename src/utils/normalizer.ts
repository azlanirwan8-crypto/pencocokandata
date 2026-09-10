// String and data normalizer functions

/**
 * Standardize postal code to 5-digit string with leading zeros preserved
 */
export function normalizeKodePos(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';
  // Extract digits
  const cleanDigits = str.replace(/\D/g, '');
  if (!cleanDigits) return str;
  // Pad with leading zeros up to 5 digits if needed
  if (cleanDigits.length <= 5) {
    return cleanDigits.padStart(5, '0');
  }
  return cleanDigits.slice(0, 5);
}

/**
 * Clean and standardize general text for comparison
 */
export function cleanText(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/\\,.]+/g, ' ');
}

/**
 * Compute similarity score between two Indonesian administrative texts (0.0 to 1.0)
 * Uses exact match, token overlap, and substring inclusion
 */
export function textSimilarityScore(a: string, b: string): number {
  const s1 = cleanText(a);
  const s2 = cleanText(b);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;

  // Substring inclusion bonus
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.75 + 0.25 * (minLen / maxLen);
  }

  // Token overlap (e.g. "Kec. Kebayoran Baru" vs "Kebayoran Baru")
  const tokens1 = new Set(s1.split(' ').filter(t => t.length > 2));
  const tokens2 = new Set(s2.split(' ').filter(t => t.length > 2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let matches = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) matches++;
  }

  const unionSize = new Set([...tokens1, ...tokens2]).size;
  return matches / unionSize;
}
