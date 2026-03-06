import { Context, InlineKeyboard } from 'grammy';
import { getCreator } from '../../db/creators';
import { getChatByChatId, createChat } from '../../db/chats';
import { generateTicker } from '../../utils/ticker';
import { buildTweetUrl } from '../../utils/tweet';
import { launchChatToken } from '../../bags/launch';

export async function lockCommand(ctx: Context) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) return;

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.reply('You need to /setup first.');
    return;
  }

  const existing = await getChatByChatId(chatId);
  if (existing) {
    await ctx.reply(
      `This chat is already locked.\nCA: \`${existing.token_mint}\`\n\nbags.fm/${existing.token_mint}`,
      { parse_mode: 'Markdown' },
    );
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('$5k', `threshold:${chatId}:5000`)
    .text('$10k', `threshold:${chatId}:10000`)
    .text('$50k', `threshold:${chatId}:50000`);

  await ctx.reply('Set unlock threshold:', { reply_markup: keyboard });
}

export async function handleThresholdCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('threshold:')) return false;

  const parts = data.split(':');
  const chatId = parseInt(parts[1]);
  const threshold = parseInt(parts[2]);
  const thresholdK = threshold / 1000;
  const userId = ctx.from?.id;

  if (!userId) return true;

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.answerCallbackQuery({ text: 'You need to /setup first.' });
    return true;
  }

  await ctx.answerCallbackQuery({ text: 'Launching token...' });

  try {
    await ctx.editMessageText(`Launching token... threshold: $${thresholdK}k`);
  } catch {}

  const chatContext = ctx.callbackQuery?.message?.chat;
  const fanUsername = chatContext?.type === 'private' && chatContext.username
    ? chatContext.username
    : undefined;

  const ticker = generateTicker(fanUsername, 'FAN');

  let tokenMint: string;
  try {
    tokenMint = await launchChatToken(creator.wallet_address, ticker, fanUsername ?? 'anon');

    await createChat(
      chatId,
      creator.telegram_user_id,
      null,
      fanUsername ?? null,
      ticker,
      tokenMint,
      threshold,
    );
  } catch (err) {
    console.error('[lock] Token launch failed:', err);
    try {
      await ctx.editMessageText('Token launch failed, try again.');
    } catch {}
    return true;
  }

  try {
    await ctx.editMessageText(
      `🔒 this chat is locked\n\n` +
      `pump $${ticker} to $${thresholdK}k mc to unlock these dms\n\n` +
      `CA: ${tokenMint}\n\n` +
      `bags.fm/${tokenMint}`,
    );
  } catch {}

  const tweetUrl = buildTweetUrl(ticker, thresholdK, tokenMint);
  const shareKeyboard = new InlineKeyboard()
    .url('Share on Twitter 🐦', tweetUrl);

  try {
    await ctx.api.sendMessage(
      userId,
      `🚀 $${ticker} launched\n\nCA: \`${tokenMint}\``,
      {
        parse_mode: 'Markdown',
        reply_markup: shareKeyboard,
      },
    );
  } catch {}

  return true;
}
