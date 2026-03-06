import { Context } from 'grammy';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { getCreator, createCreator } from '../../db/creators';
import { encrypt } from '../../utils/encrypt';

const pendingSetups = new Map<number, true>();

export async function setupCommand(ctx: Context) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username ?? null;
  if (!userId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply('DM me to set up: @onlybagsappbot');
    return;
  }

  const existing = await getCreator(userId);
  if (existing) {
    await ctx.reply(`You're already set up.\nWallet: \`${existing.wallet_address}\``, {
      parse_mode: 'Markdown',
    });
    return;
  }

  pendingSetups.set(userId, true);
  await ctx.reply(
    'Send me your Solana wallet private key (base58).\n\n' +
    'This is stored encrypted and used to auto-launch tokens when you /lock.\n' +
    'Never share this with anyone else.',
  );
}

export async function handleSetupKey(ctx: Context) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username ?? null;
  if (!userId || !pendingSetups.has(userId)) return false;
  if (ctx.chat?.type !== 'private') return false;

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  // Delete the message containing the private key immediately
  try {
    await ctx.deleteMessage();
  } catch {}

  pendingSetups.delete(userId);

  let keypair: Keypair;
  try {
    const decoded = bs58.decode(text);
    keypair = Keypair.fromSecretKey(decoded);
  } catch {
    await ctx.reply('Invalid private key. Try /setup again with a valid base58 Solana private key.');
    return true;
  }

  const walletAddress = keypair.publicKey.toBase58();
  const encryptedKey = encrypt(text);

  await createCreator(userId, username, walletAddress, encryptedKey);

  await ctx.reply(
    `✅ You're set up.\nWallet: \`${walletAddress}\`\n\n` +
    'Share your OnlyBags link with fans:\n' +
    `\`https://t.me/onlybagsappbot?start=${username ?? userId}\`\n\n` +
    'When a fan messages you through the bot, type /lock to gate the conversation.',
    { parse_mode: 'Markdown' },
  );

  return true;
}
