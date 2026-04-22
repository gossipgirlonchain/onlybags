import crypto from 'crypto';
import { Context, InlineKeyboard } from 'grammy';
import { getCreator } from '../../db/creators';
import {
  createChat,
  isTickerTaken,
  setTokenAddress,
} from '../../db/chats';
import { launchToken } from '../../doppler/launch';
import {
  defaultTicker,
  normalizeTicker,
  validateTickerShape,
} from '../../utils/ticker';
import { buildTweetUrl } from '../../utils/tweet';

const BOT_USERNAME = 'gatekeepfunbot';

interface PendingLock {
  fanUsername: string;
  ticker: string;
  expiresAt: number;
}
const TTL_MS = 5 * 60 * 1000;
const pendingLocks = new Map<number, PendingLock>();

function thresholdKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('$5k', 'lock:5000')
    .text('$10k', 'lock:10000')
    .text('$50k', 'lock:50000');
}

export async function lockCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply(`DM me to lock: @${BOT_USERNAME}`);
    return;
  }

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.reply('you need to /setup first');
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/lock(?:@\w+)?\s*/i, '').trim();

  if (!args) {
    await ctx.reply(
      'usage: /lock @fan [$TICKER]\n\n' +
      'examples:\n' +
      '/lock @alice\n' +
      '/lock @alice $WINPLZ\n\n' +
      'i\'ll launch the token and give you a message to paste in your dm with them.',
    );
    return;
  }

  const parts = args.split(/\s+/);
  const fanArg = parts[0].replace(/^@/, '').toLowerCase();
  const tickerArg = parts[1] ? normalizeTicker(parts[1]) : null;

  if (!fanArg || !/^[a-z0-9_]{3,32}$/.test(fanArg)) {
    await ctx.reply('that doesn\'t look like a valid telegram username. usage: /lock @username');
    return;
  }

  const ticker = tickerArg ?? defaultTicker(creator.twitter_username, fanArg);

  const shape = validateTickerShape(ticker);
  if (!shape.ok) {
    await ctx.reply(
      `ticker $${ticker} invalid: ${shape.reason}\n\n` +
      `try /lock @${fanArg} $YOURIDEA`,
    );
    return;
  }

  if (await isTickerTaken(ticker)) {
    await ctx.reply(
      `$${ticker} is already in use on GateKeep. pick another.\n` +
      `/lock @${fanArg} $ANOTHERIDEA`,
    );
    return;
  }

  pendingLocks.set(userId, { fanUsername: fanArg, ticker, expiresAt: Date.now() + TTL_MS });

  await ctx.reply(
    `lock for @${fanArg} as $${ticker}\n\n` +
    `pick the unlock threshold:`,
    { reply_markup: thresholdKeyboard() },
  );
}

export async function handleLockCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('lock:')) return false;

  const userId = ctx.from?.id;
  if (!userId) return true;

  const threshold = parseInt(data.split(':')[1]);
  if (Number.isNaN(threshold)) return true;

  const pending = pendingLocks.get(userId);
  if (!pending || Date.now() > pending.expiresAt) {
    pendingLocks.delete(userId);
    await ctx.answerCallbackQuery({ text: 'lock expired, run /lock again' });
    return true;
  }

  const creator = await getCreator(userId);
  if (!creator) {
    await ctx.answerCallbackQuery({ text: 'run /setup first' });
    return true;
  }

  await ctx.answerCallbackQuery({ text: 'launching token...' });
  pendingLocks.delete(userId);

  try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}

  const { ticker, fanUsername } = pending;
  const launchId = crypto.randomUUID();
  const thresholdK = threshold / 1000;

  // Re-check uniqueness right before launch (race-safe via UNIQUE INDEX too)
  if (await isTickerTaken(ticker)) {
    try { await ctx.editMessageText(`❌ $${ticker} was just claimed. /lock @${fanUsername} $NEWIDEA`); } catch {}
    return true;
  }

  try {
    const chatId = Number((BigInt('0x' + launchId.replace(/-/g, '').slice(0, 12))) & 0x7fffffffffffffn);
    await createChat(launchId, chatId, creator.telegram_user_id, ticker, threshold, undefined, fanUsername);

    try { await ctx.editMessageText(`launching $${ticker} on Base...`); } catch {}

    const tokenAddress = await launchToken(launchId, ticker, creator.wallet_address);
    await setTokenAddress(launchId, tokenAddress);

    const shortCa = `${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)}`;
    const tokenUrl = `app.doppler.lol/tokens/${tokenAddress}`;
    const deeplink = `https://t.me/${BOT_USERNAME}?start=lock_${launchId}`;
    const tweetUrl = buildTweetUrl(ticker, thresholdK, tokenUrl, fanUsername);

    const fanMessage =
      `@${fanUsername} — pump $${ticker} to $${thresholdK}k mc to unlock my dms\n` +
      `${deeplink}\n` +
      `verified by @${BOT_USERNAME} · ${shortCa}`;

    const shareKb = new InlineKeyboard().url('share on Twitter', tweetUrl);

    try {
      await ctx.editMessageText(
        `🔒 $${ticker} launched\n\n` +
        `CA: \`${tokenAddress}\`\n` +
        `for: @${fanUsername}\n` +
        `unlock at $${thresholdK}k mc\n\n` +
        `*paste this in your chat with @${fanUsername}:*\n` +
        `\`\`\`\n${fanMessage}\n\`\`\``,
        { parse_mode: 'Markdown', reply_markup: shareKb },
      );
    } catch (err) {
      console.error('[lock] editMessageText failed:', err);
      await ctx.api.sendMessage(
        userId,
        `🔒 $${ticker} launched. paste this to @${fanUsername}:\n\n${fanMessage}`,
      );
    }
  } catch (err) {
    console.error('[lock] launch failed:', err);
    try { await ctx.editMessageText(`❌ $${ticker} launch failed. try /lock again.`); } catch {}
  }

  return true;
}
