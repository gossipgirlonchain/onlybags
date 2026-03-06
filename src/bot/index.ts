import { Bot } from 'grammy';
import { setupCommand, handleSetupKey } from './commands/setup';
import { lockCommand, handleThresholdCallback } from './commands/lock';
import { statusCommand } from './commands/status';
import { getCreatorByUsername, getCreator } from '../db/creators';
import { getChatByChatId, getChatsByCreator } from '../db/chats';

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

// --- Commands ---
bot.command('setup', setupCommand);
bot.command('lock', lockCommand);
bot.command('status', statusCommand);

// --- Callback queries (threshold selection) ---
bot.on('callback_query:data', async (ctx) => {
  const handled = await handleThresholdCallback(ctx);
  if (!handled) {
    await ctx.answerCallbackQuery();
  }
});

// --- /start deep link (relay entry point) ---
bot.command('start', async (ctx) => {
  const payload = ctx.match; // e.g. "winny" from t.me/OnlyBagsBot?start=winny
  if (!payload) {
    await ctx.reply(
      '👋 Welcome to OnlyBags\n\n' +
      'Creators: /setup to get started\n' +
      'Fans: use a creator\'s OnlyBags link to message them',
    );
    return;
  }

  const fanId = ctx.from?.id;
  const fanUsername = ctx.from?.username ?? ctx.from?.first_name ?? 'anon';
  if (!fanId) return;

  // Look up the creator by username or user ID
  let creator = await getCreatorByUsername(payload);
  if (!creator) {
    const parsed = parseInt(payload);
    if (!isNaN(parsed)) {
      creator = await getCreator(parsed);
    }
  }

  if (!creator) {
    await ctx.reply('Creator not found. Check the link and try again.');
    return;
  }

  if (fanId === creator.telegram_user_id) {
    await ctx.reply(
      'That\'s your own link! Share it with fans:\n' +
      `\`https://t.me/OnlyBagsBot?start=${creator.telegram_username ?? creator.telegram_user_id}\``,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  await ctx.reply(
    `You want to reach @${creator.telegram_username ?? 'this creator'}.\n\n` +
    'They\'ll lock this chat with a token — pump it to unlock their DMs.\n\n' +
    'Waiting for the creator to /lock...',
  );

  // Notify the creator that a fan is waiting
  try {
    await bot.api.sendMessage(
      creator.telegram_user_id,
      `👀 @${fanUsername} wants in your DMs.\n\n` +
      `Chat ID: \`${ctx.chat?.id}\`\n` +
      'Reply /lock in that chat to gate it with a token.',
      { parse_mode: 'Markdown' },
    );
  } catch (err) {
    console.error('[relay] Failed to notify creator:', err);
  }
});

// --- Message relay ---
bot.on('message:text', async (ctx) => {
  // Check if this is a setup key being sent
  const handled = await handleSetupKey(ctx);
  if (handled) return;

  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId || ctx.chat?.type !== 'private') return;

  // Check if this chat has a locked conversation
  const chat = await getChatByChatId(chatId);
  if (!chat) return; // not a locked chat, ignore

  if (!chat.unlocked) {
    const thresholdK = chat.threshold_usd / 1000;
    await ctx.reply(
      `🔒 Chat is still locked.\n\n` +
      `Pump $${chat.ticker} to $${thresholdK}k to unlock.\n\n` +
      `CA: ${chat.token_mint}\nbags.fm/${chat.token_mint}`,
    );
    return;
  }

  // Chat is unlocked — relay the message
  const isCreator = userId === chat.creator_telegram_id;
  const targetId = isCreator ? chat.fan_telegram_id : chat.creator_telegram_id;

  if (!targetId) return;

  const senderName = ctx.from?.username
    ? `@${ctx.from.username}`
    : ctx.from?.first_name ?? 'Someone';

  try {
    await bot.api.sendMessage(
      targetId,
      `${senderName}: ${ctx.message?.text}`,
    );
  } catch (err) {
    console.error('[relay] Failed to forward message:', err);
    await ctx.reply('Failed to deliver message. The other person may have blocked the bot.');
  }
});

export async function startBot() {
  console.log('Bot starting (long polling)...');
  bot.start();
}
