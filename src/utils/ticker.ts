const WORDS = [
  'BAGS', 'CHAT', 'DMS', 'LOCK', 'PUMP', 'PASS',
  'GATE', 'KEY', 'OPEN', 'LFG', 'SEND', 'VIBE',
];

export function generateTicker(): string {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `${word}${suffix}`;
}
