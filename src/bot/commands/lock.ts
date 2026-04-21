import crypto from 'crypto';
import { Context, InlineKeyboard } from 'grammy';
import { getCreator } from '../../db/creators';
import { createChat, setTokenAddress } from '../../db/chats';
import { generateTicker } from '../../utils/ticker';
import { buildTweetUrl } from '../../utils/tweet';
import { launchToken } from '../../doppler/launch';

export async function lockCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply('DM me to lock: @gatekeepfunbot');
    return;
  }

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.reply('you need to /setup first');
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('$5k', 'lock:5000')
    .text('$10k', 'lock:10000')
    .text('$50k', 'lock:50000');

  await ctx.reply('set unlock threshold:', { reply_markup: keyboard });
}

export async function handleLockCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('lock:')) return false;

  const threshold = parseInt(data.split(':')[1]);
  const thresholdK = threshold / 1000;
  const userId = ctx.from?.id;

  if (!userId) return true;

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.answerCallbackQuery({ text: 'you need to /setup first' });
    return true;
  }

  await ctx.answerCallbackQuery({ text: 'launching token...' });

  const ticker = generateTicker(creator.twitter_username);
  const launchId = crypto.randomUUID();

  try {
    await ctx.editMessageText(`launching $${ticker} on Base...`);
  } catch {}

  try {
    await createChat(launchId, Date.now(), creator.telegram_user_id, ticker, threshold);

    const tokenAddress = await launchToken(
      launchId,
      ticker,
      creator.wallet_address,
    );

    await setTokenAddress(launchId, tokenAddress);

    try {
      await ctx.editMessageText(
        `🔒 $${ticker} launched\n\n` +
        `CA: ${tokenAddress}\n` +
        `threshold: $${thresholdK}k\n\n` +
        `send this to the fan:\n` +
        `pump $${ticker} to $${thresholdK}k mc to unlock my DMs\n` +
        `app.doppler.lol/tokens/${tokenAddress}`,
      );
    } catch {}

    const tweetUrl = buildTweetUrl(ticker, thresholdK, `app.doppler.lol/tokens/${tokenAddress}`);
    const shareKeyboard = new InlineKeyboard().url('share on Twitter', tweetUrl);

    try {
      await ctx.api.sendMessage(
        userId,
        `$${ticker} launched\n\nCA: \`${tokenAddress}\``,
        { parse_mode: 'Markdown', reply_markup: shareKeyboard },
      );
    } catch {}
  } catch (err) {
    console.error('[lock] Launch failed:', err);
    try {
      await ctx.editMessageText('token launch failed. try again with /lock');
    } catch {}
  }

  return true;
}
