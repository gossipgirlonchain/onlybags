import { Context } from 'grammy';
import { getChatByChatId } from '../../db/chats';
import { getTokenMarketCapUsd } from '../../bags/mc';

function progressBar(pct: number): string {
  const filled = Math.min(Math.round(pct / 10), 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export async function statusCommand(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const chat = await getChatByChatId(chatId);
  if (!chat) {
    await ctx.reply('This chat is not locked. A creator needs to /lock it first.');
    return;
  }

  if (chat.unlocked) {
    await ctx.reply(
      `🔓 $${chat.ticker} — DMs are unlocked!\n\n` +
      `Final MC: $${Number(chat.current_mc_usd).toLocaleString()}\n\n` +
      `bags.fm/${chat.token_mint}`,
    );
    return;
  }

  let mc: number;
  try {
    mc = await getTokenMarketCapUsd(chat.token_mint);
  } catch {
    mc = Number(chat.current_mc_usd);
  }

  const pct = Math.min(Math.round((mc / chat.threshold_usd) * 100), 100);
  const thresholdK = chat.threshold_usd / 1000;

  await ctx.reply(
    `📊 $${chat.ticker}\n\n` +
    `Current MC: $${mc.toLocaleString()}\n` +
    `Threshold: $${chat.threshold_usd.toLocaleString()}\n` +
    `Progress: ${progressBar(pct)} ${pct}%\n\n` +
    `bags.fm/${chat.token_mint}`,
  );
}
