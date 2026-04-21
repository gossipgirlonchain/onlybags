const MAX_LEN = 10;
const FALLBACK = 'GATE';

export function generateTicker(twitterUsername: string): string {
  const cleaned = twitterUsername.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length === 0) return FALLBACK;
  return cleaned.slice(0, MAX_LEN);
}
