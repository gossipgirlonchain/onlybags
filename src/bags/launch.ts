import {
  BagsSDK,
  signAndSendTransaction,
  sendBundleAndConfirm,
  createTipTransaction,
  waitForSlotsToPass,
} from '@bagsfm/bags-sdk';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from '@solana/web3.js';

const PLATFORM_WALLET = new PublicKey(process.env.BAGS_PLATFORM_WALLET!);

export async function launchChatToken(
  creatorKeypair: Keypair,
  ticker: string,
  fanUsername: string,
): Promise<string> {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const sdk = new BagsSDK(process.env.BAGS_API_KEY!, connection, 'processed');
  const commitment = sdk.state.getCommitment();

  // 1. Create token metadata
  const tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
    imageUrl: 'https://onlybags.xyz/default-token-image.png',
    name: `${ticker} Pass`,
    symbol: ticker.toUpperCase(),
    description: `Unlock DMs. Pump $${ticker.toUpperCase()} to reach the threshold.`,
    website: 'https://onlybags.xyz',
    telegram: 'https://t.me/onlybagsappbot',
  });

  const tokenMint = new PublicKey(tokenInfo.tokenMint);

  // 2. Fee share config — 75% creator, 25% OnlyBags platform
  const feeClaimers = [
    { user: creatorKeypair.publicKey, userBps: 7500 },
    { user: PLATFORM_WALLET, userBps: 2500 },
  ];

  const configResult = await sdk.config.createBagsFeeShareConfig({
    feeClaimers,
    payer: creatorKeypair.publicKey,
    baseMint: tokenMint,
  });

  // Sign and send config transactions
  for (const tx of configResult.transactions) {
    await signAndSendTransaction(connection, commitment, tx, creatorKeypair);
    await waitForSlotsToPass(connection, commitment);
  }

  // Send any bundles (Jito bundles for config setup)
  for (const bundle of configResult.bundles) {
    const signed = bundle.map((tx) => {
      tx.sign([creatorKeypair]);
      return tx;
    });
    await sendBundleAndConfirm(signed, sdk);
  }

  const configKey = configResult.meteoraConfigKey;

  // 3. Create launch transaction — no initial buy
  const launchTx = await sdk.tokenLaunch.createLaunchTransaction({
    metadataUrl: tokenInfo.tokenMetadata,
    tokenMint,
    launchWallet: creatorKeypair.publicKey,
    initialBuyLamports: 0,
    configKey,
  });

  // 4. Sign and send
  await signAndSendTransaction(connection, commitment, launchTx, creatorKeypair);

  return tokenInfo.tokenMint;
}
