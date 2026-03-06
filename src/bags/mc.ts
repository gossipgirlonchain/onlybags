export async function getTokenMarketCapUsd(tokenMint: string): Promise<number> {
  // Try Bags public API first
  try {
    const res = await fetch(
      `https://public-api-v2.bags.fm/api/v1/tokens/${tokenMint}`,
      { headers: { 'x-api-key': process.env.BAGS_API_KEY! } },
    );
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      console.log('[mc] Bags API response for', tokenMint, JSON.stringify(data).slice(0, 500));
      return (data.marketCapUsd ?? data.market_cap_usd ?? data.mcap ?? 0) as number;
    }
  } catch (err) {
    console.error('[mc] Bags API error:', err);
  }

  return 0;
}
