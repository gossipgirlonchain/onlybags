import {
  BagsSDK,
  signAndSendTransaction,
  sendBundleAndConfirm,
  waitForSlotsToPass,
} from '@bagsfm/bags-sdk';
import {
  Connection,
  Keypair,
  PublicKey,
} from '@solana/web3.js';
import bs58 from 'bs58';

const PLATFORM_WALLET = new PublicKey(process.env.BAGS_PLATFORM_WALLET!);

function getServerKeypair(): Keypair {
  const key = process.env.SERVER_PRIVATE_KEY;
  if (!key) throw new Error('SERVER_PRIVATE_KEY not set');
  return Keypair.fromSecretKey(bs58.decode(key));
}

export async function launchChatToken(
  creatorWalletAddress: string,
  ticker: string,
  fanUsername: string,
): Promise<string> {
  const serverKeypair = getServerKeypair();
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const sdk = new BagsSDK(process.env.BAGS_API_KEY!, connection, 'processed');
  const commitment = sdk.state.getCommitment();

  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    imageUrl: 'https://onlybags.xyz/default-token-image.png',
    name: `${ticker} Pass`,
    symbol: ticker.toUpperCase(),
    description: `Unlock DMs. Pump $${ticker.toUpperCase()} to reach the threshold.`,
    website: 'https://onlybags.xyz',
    telegram: 'https://t.me/onlybagsappbot',
  });

  const tokenMint = new PublicKey(tokenInfo.tokenMint);
  const creatorWallet = new PublicKey(creatorWalletAddress);

  // 75% to creator, 25% to OnlyBags platform
  const feeClaimers = [
    { user: creatorWallet, userBps: 7500 },
    { user: PLATFORM_WALLET, userBps: 2500 },
  ];

  const configResult = await sdk.config.createBagsFeeShareConfig({
    feeClaimers,
    payer: serverKeypair.publicKey,
    baseMint: tokenMint,
  });

  for (const tx of configResult.transactions) {
    await signAndSendTransaction(connection, commitment, tx, serverKeypair);
    await waitForSlotsToPass(connection, commitment);
  }

  for (const bundle of configResult.bundles) {
    const signed = bundle.map((tx) => {
      tx.sign([serverKeypair]);
      return tx;
    });
    await sendBundleAndConfirm(signed, sdk);
  }

  const configKey = configResult.meteoraConfigKey;

  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    metadataUrl: tokenInfo.tokenMetadata,
    tokenMint,
    launchWallet: serverKeypair.publicKey,
    initialBuyLamports: 0,
    configKey,
  });

  await signAndSendTransaction(connection, commitment, launchTx, serverKeypair);

  return tokenInfo.tokenMint;
}
