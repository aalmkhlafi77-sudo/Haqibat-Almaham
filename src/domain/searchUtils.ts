const ARABIC_TO_LATIN_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

/**
 * Normalizes Arabic spelling variations (أ/إ/آ -> ا, ة -> ه, ى -> ي, ؤ -> و, ئ -> ي),
 * removes diacritics/tatweel, and normalizes Arabic digits to Latin 0-9.
 */
export function normalizeArabicSearchText(input: string): string {
  if (!input) return '';
  let out = input
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // diacritics & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();

  let digitsNormalized = '';
  for (const ch of out) {
    digitsNormalized += ARABIC_TO_LATIN_DIGITS[ch] ?? ch;
  }
  return digitsNormalized.replace(/\s+/g, ' ').trim();
}

/**
 * Computes relevance score (>0 means match; higher means closer match).
 */
export function scoreArabicSearchMatch(
  query: string,
  primaryText: string,
  secondaryFields: Array<string | null | undefined> = []
): number {
  const nq = normalizeArabicSearchText(query);
  if (!nq) return 1;

  const np = normalizeArabicSearchText(primaryText);
  if (np === nq) return 1000;
  if (np.startsWith(nq)) return 800;
  if (np.includes(nq)) return 600;

  // Token match across primary + secondary
  const tokens = nq.split(' ').filter(Boolean);
  const combinedSecondary = secondaryFields
    .filter(Boolean)
    .map((s) => normalizeArabicSearchText(s!))
    .join(' ');

  if (combinedSecondary.includes(nq)) return 400;

  const fullHaystack = `${np} ${combinedSecondary}`;
  if (tokens.length > 0 && tokens.every((tok) => fullHaystack.includes(tok))) {
    // Reward if primary hits at least some tokens
    const primaryHits = tokens.filter((tok) => np.includes(tok)).length;
    return 200 + primaryHits * 40;
  }

  return 0;
}
