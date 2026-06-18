// URL normalization + validation.
// Only http/https absolute URLs are allowed. We never touch page content, so this
// is purely about producing a value safe to pass to chrome.tabs.create({ url }).

export interface UrlValidationResult {
  valid: string[];
  invalid: string[];
}

/** Validate & normalize a single URL string. Returns the normalized URL or null. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Allow users to omit the scheme: "example.com" -> "https://example.com".
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Validate & normalize a list, separating valid (normalized) from invalid lines. */
export function normalizeUrlList(inputs: string[]): UrlValidationResult {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of inputs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const normalized = normalizeUrl(trimmed);
    if (normalized) valid.push(normalized);
    else invalid.push(trimmed);
  }
  return { valid, invalid };
}

/** Parse a textarea blob (one URL per line) into raw lines. */
export function linesToArray(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
