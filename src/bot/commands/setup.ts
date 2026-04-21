import { Context } from 'grammy';
import { getCreator, createCreator } from '../../db/creators';

interface PendingSetup {
  step: 'twitter' | 'wallet';
  twitterUsername?: string;
}

const pendingSetups = new Map<number, PendingSetup>();

export async function setupCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply('DM me to set up: @gatekeepfunbot');
    return;
  }

  const existing = await getCreator(userId);
  if (existing) {
    await ctx.reply(
      `already set up\n\n` +
      `Twitter: @${existing.twitter_username}\n` +
      `Wallet: \`${existing.wallet_address}\``,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  pendingSetups.set(userId, { step: 'twitter' });
  await ctx.reply("what's your Twitter/X username? (without the @)");
}

export async function handleSetupInput(ctx: Context) {
  const userId = ctx.from?.id;
  const telegramUsername = ctx.from?.username ?? null;
  if (!userId) return false;

  const pending = pendingSetups.get(userId);
  if (!pending) return false;
  if (ctx.chat?.type !== 'private') return false;

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  if (pending.step === 'twitter') {
    const twitterUsername = text.replace(/^@/, '');
    pendingSetups.set(userId, { step: 'wallet', twitterUsername });
    await ctx.reply(
      `got it, @${twitterUsername}\n\n` +
      'now enter your Base wallet address (0x...) where fees will go:',
    );
    return true;
  }

  if (pending.step === 'wallet') {
    const wallet = text.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      await ctx.reply("doesn't look like a valid address. enter a 0x... wallet:");
      return true;
    }

    const twitterUsername = pending.twitterUsername!;
    pendingSetups.delete(userId);

    await createCreator(userId, telegramUsername, twitterUsername, wallet);

    await ctx.reply(
      `connected\n\n` +
      `Twitter: @${twitterUsername}\n` +
      `Wallet: \`${wallet}\`\n\n` +
      `when someone DMs you, type /lock to gate the conversation with a token`,
      { parse_mode: 'Markdown' },
    );
    return true;
  }

  return false;
}
