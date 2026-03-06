import { Context } from 'grammy';
import { Connection } from '@solana/web3.js';
import { BagsSDK } from '@bagsfm/bags-sdk';
import { getCreator, createCreator } from '../../db/creators';

const pendingSetups = new Map<number, true>();

export async function setupCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply('DM me to set up: @onlybagsappbot');
    return;
  }

  const existing = await getCreator(userId);
  if (existing) {
    await ctx.reply(
      `You're already set up.\n` +
      `Twitter: @${existing.twitter_username}\n` +
      `Wallet: \`${existing.wallet_address}\``,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  pendingSetups.set(userId, true);
  await ctx.reply('What\'s your Twitter/X username? (without the @)');
}

export async function handleSetupTwitter(ctx: Context) {
  const userId = ctx.from?.id;
  const telegramUsername = ctx.from?.username ?? null;
  if (!userId || !pendingSetups.has(userId)) return false;
  if (ctx.chat?.type !== 'private') return false;

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  pendingSetups.delete(userId);

  // Strip @ if they included it
  const twitterUsername = text.replace(/^@/, '');

  try {
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    const sdk = new BagsSDK(process.env.BAGS_API_KEY!, connection, 'processed');

    const result = await sdk.state.getLaunchWalletV2(twitterUsername, 'twitter');
    const walletAddress = result.wallet.toBase58();

    await createCreator(userId, telegramUsername, twitterUsername, walletAddress);

    await ctx.reply(
      `✅ Connected. Fees will go to your Bags wallet:\n` +
      `\`${walletAddress}\`\n\n` +
      `Share your OnlyBags link with fans:\n` +
      `\`https://t.me/onlybagsappbot?start=${telegramUsername ?? userId}\`\n\n` +
      `Type /lock in any chat to start gating your DMs.`,
      { parse_mode: 'Markdown' },
    );
  } catch (err) {
    console.error('[setup] Bags wallet lookup failed:', err);
    await ctx.reply(
      `Couldn't find a Bags account for @${twitterUsername}. ` +
      `Make sure you've signed up at bags.fm first, then try /setup again.`,
    );
  }

  return true;
}
