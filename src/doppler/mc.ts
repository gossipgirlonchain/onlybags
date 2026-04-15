const INDEXER_URL = process.env.DOPPLER_INDEXER_URL ?? 'https://test.indexer.doppler.lol';
const BASE_CHAIN_ID = 8453;

interface TokenData {
  address: string;
  volumeUsd: string;
  pool: { price: string; dollarLiquidity: string } | null;
}

export async function getTokenMarketCapUsd(tokenAddress: string): Promise<number> {
  const query = `
    query TokenMC($id: String!) {
      token(id: $id) {
        address
        volumeUsd
        pool {
          price
          dollarLiquidity
        }
      }
    }
  `;

  try {
    const res = await fetch(`${INDEXER_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { id: tokenAddress.toLowerCase() },
      }),
    });

    if (!res.ok) {
      console.error('[mc] Doppler indexer HTTP error:', res.status);
      return 0;
    }

    const json = await res.json() as { data?: { token?: TokenData } };
    const token = json.data?.token;

    if (!token?.pool?.dollarLiquidity) return 0;

    // dollarLiquidity is the USD value of liquidity in the pool
    // which serves as a proxy for market cap during the bonding curve phase
    return parseFloat(token.pool.dollarLiquidity);
  } catch (err) {
    console.error('[mc] Doppler indexer error:', err);
    return 0;
  }
}
