export function buildTweetUrl(ticker: string, thresholdK: number, ca: string): string {
  const text = [
    'someone wants in my dms 👀',
    `pump $${ticker} to $${thresholdK}k to find out if i reply`,
    `CA: ${ca}`,
    `bags.fm/${ca}`,
  ].join('\n');
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
