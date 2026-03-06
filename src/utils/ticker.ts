export function generateTicker(username?: string, firstName?: string): string {
  const raw = username ?? firstName ?? 'ANON';
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  if (cleaned.length >= 3) return cleaned;
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return (cleaned + suffix).slice(0, 6);
}
