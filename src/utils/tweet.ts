export function buildTweetUrl(ticker: string, thresholdK: number, tokenUrl: string): string {
  const text = [
    'someone wants in my dms',
    `pump $${ticker} to $${thresholdK}k to find out if i reply`,
    tokenUrl,
  ].join('\n');
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
