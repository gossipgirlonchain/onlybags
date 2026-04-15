import { DopplerSDK } from '@whetstone-research/doppler-sdk/evm';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const WETH_BASE = '0x4200000000000000000000000000000000000006' as Address;
const APP_URL = process.env.APP_URL ?? 'https://gatekeep.fun';

function getServerAccount() {
  const key = process.env.SERVER_PRIVATE_KEY as `0x${string}`;
  if (!key) throw new Error('SERVER_PRIVATE_KEY not set');
  return privateKeyToAccount(key);
}

async function getEthPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    const data = (await res.json()) as { ethereum: { usd: number } };
    return data.ethereum.usd;
  } catch {
    return 3000;
  }
}

export async function launchToken(
  launchId: string,
  ticker: string,
  creatorWallet: string,
): Promise<string> {
  const account = getServerAccount();
  const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';

  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    chain: base,
    transport: http(rpcUrl),
    account,
  });

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id });
  const ethPrice = await getEthPrice();
  const protocolOwner = await sdk.getAirlockBeneficiary();

  const beneficiaries = [
    protocolOwner,
    { beneficiary: creatorWallet as Address, shares: parseEther('0.95') },
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      name: `${ticker} Pass`,
      symbol: ticker.toUpperCase(),
      tokenURI: `${APP_URL}/api/metadata/${launchId}`,
    })
    .saleConfig({
      initialSupply: parseEther('1000000000'),
      numTokensToSell: parseEther('900000000'),
      numeraire: WETH_BASE,
    })
    .withCurves({
      numerairePrice: ethPrice,
      curves: [
        { marketCap: { start: 5_000, end: 50_000 }, numPositions: 10, shares: parseEther('0.5') },
        { marketCap: { start: 50_000, end: 500_000 }, numPositions: 10, shares: parseEther('0.4') },
        { marketCap: { start: 500_000, end: 'max' }, numPositions: 1, shares: parseEther('0.1') },
      ],
      beneficiaries,
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .build();

  const result = await sdk.factory.createMulticurve(params);
  return result.tokenAddress;
}
