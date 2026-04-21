import crypto from 'crypto';
import { Context, InlineKeyboard } from 'grammy';
import { getCreator } from '../../db/creators';
import { createChat, setTokenAddress } from '../../db/chats';
import {
  decideRequest,
  getRequest,
  isTickerTaken,
  setRequestTicker,
} from '../../db/requests';
import { launchToken } from '../../doppler/launch';
import { buildTweetUrl } from '../../utils/tweet';
import {
  containsCreatorSubstring,
  normalizeTicker,
  validateTickerShape,
} from '../../utils/ticker';

interface PendingEdit {
  requestId: number;
  expiresAt: number;
}
const EDIT_TTL_MS = 5 * 60 * 1000;
const pendingEdits = new Map<number, PendingEdit>();

export async function handleRequestCallback(ctx: Context): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('req:')) return false;

  const [, action, idStr] = data.split(':');
  const requestId = parseInt(idStr);
  const userId = ctx.from?.id;
  if (!userId || Number.isNaN(requestId)) return true;

  const req = await getRequest(requestId);
  if (!req) {
    await ctx.answerCallbackQuery({ text: 'request not found' });
    return true;
  }
  if (req.creator_telegram_id !== userId) {
    await ctx.answerCallbackQuery({ text: 'not your request' });
    return true;
  }
  if (req.status !== 'pending') {
    await ctx.answerCallbackQuery({ text: `already ${req.status}` });
    return true;
  }

  if (action === 'reject') {
    await decideRequest(requestId, 'rejected');
    await ctx.answerCallbackQuery({ text: 'rejected' });
    try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}
    try {
      await ctx.editMessageText(
        `❌ rejected request from @${req.fan_username ?? 'fan'} ($${req.proposed_ticker})`,
      );
    } catch {}
    try {
      await ctx.api.sendMessage(
        req.fan_telegram_id,
        `your request for $${req.proposed_ticker} was rejected.`,
      );
    } catch {}
    return true;
  }

  if (action === 'edit') {
    pendingEdits.set(userId, { requestId, expiresAt: Date.now() + EDIT_TTL_MS });
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `send the new ticker (3-10 chars, A-Z 0-9, 5 min to reply).\n\n` +
      `as the creator you can override the substring rule.`,
    );
    return true;
  }

  if (action === 'approve') {
    await ctx.answerCallbackQuery({ text: 'launching token...' });
    try { await ctx.editMessageReplyMarkup({ reply_markup: undefined }); } catch {}
    await launchAndAttach(ctx, requestId);
    return true;
  }

  return true;
}

export async function handleEditTickerInput(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;
  if (ctx.chat?.type !== 'private') return false;

  const pending = pendingEdits.get(userId);
  if (!pending) return false;
  if (Date.now() > pending.expiresAt) {
    pendingEdits.delete(userId);
    await ctx.reply('edit window expired. tap Edit again from the request.');
    return true;
  }

  const text = ctx.message?.text?.trim();
  if (!text) return false;

  const ticker = normalizeTicker(text);
  const shape = validateTickerShape(ticker);
  if (!shape.ok) {
    await ctx.reply(`invalid: ${shape.reason}. try again.`);
    return true;
  }
  if (await isTickerTaken(ticker)) {
    await ctx.reply(`$${ticker} is already taken on GateKeep. try another.`);
    return true;
  }

  const req = await getRequest(pending.requestId);
  if (!req || req.status !== 'pending') {
    pendingEdits.delete(userId);
    await ctx.reply('request no longer pending.');
    return true;
  }

  await setRequestTicker(pending.requestId, ticker);
  pendingEdits.delete(userId);

  const creator = await getCreator(userId);
  const fanLabel = req.fan_username ? `@${req.fan_username}` : 'fan';
  const note = creator && !containsCreatorSubstring(ticker, creator.twitter_username)
    ? '\n\n(substring rule overridden by you)' : '';

  await ctx.reply(
    `ticker updated to $${ticker}.${note}\n\nlaunching now...`,
  );
  await launchAndAttach(ctx, pending.requestId);
  return true;
}

async function launchAndAttach(ctx: Context, requestId: number) {
  const req = await getRequest(requestId);
  if (!req || req.status !== 'pending') return;

  const creator = await getCreator(req.creator_telegram_id);
  if (!creator) return;

  const ticker = req.proposed_ticker;
  const launchId = crypto.randomUUID();

  // Re-check uniqueness just before launch (race-safe)
  if (await isTickerTaken(ticker)) {
    await decideRequest(requestId, 'rejected');
    await ctx.api.sendMessage(
      req.creator_telegram_id,
      `❌ $${ticker} was claimed by another launch in the meantime. ask the fan to re-request.`,
    );
    await ctx.api.sendMessage(
      req.fan_telegram_id,
      `your $${ticker} request couldn't launch — ticker was taken. try /request again.`,
    );
    return;
  }

  try {
    // chat_id is unique in DB; use launchId hash as a stable surrogate
    const chatId = Number((BigInt('0x' + launchId.replace(/-/g, '').slice(0, 12))) & 0x7fffffffffffffn);

    await createChat(
      launchId,
      chatId,
      creator.telegram_user_id,
      ticker,
      req.threshold_usd,
      req.fan_telegram_id,
      req.fan_username,
    );

    const tokenAddress = await launchToken(launchId, ticker, creator.wallet_address);
    await setTokenAddress(launchId, tokenAddress);
    await decideRequest(requestId, 'approved', launchId);

    const thresholdK = req.threshold_usd / 1000;
    const shortCa = `${tokenAddress.slice(0, 6)}…${tokenAddress.slice(-4)}`;
    const tokenUrl = `app.doppler.lol/tokens/${tokenAddress}`;
    const tweetUrl = buildTweetUrl(ticker, thresholdK, tokenUrl, req.fan_username);
    const shareKb = new InlineKeyboard().url('share on Twitter', tweetUrl);

    // Notify creator
    await ctx.api.sendMessage(
      req.creator_telegram_id,
      `🔒 $${ticker} launched\n\n` +
      `CA: \`${tokenAddress}\`\n` +
      `for: @${req.fan_username ?? 'fan'}\n` +
      `unlock at $${thresholdK}k mc\n\n` +
      `verified by @gatekeepfunbot · ${shortCa}\n` +
      `${tokenUrl}`,
      { parse_mode: 'Markdown', reply_markup: shareKb },
    );

    // Notify fan
    try {
      await ctx.api.sendMessage(
        req.fan_telegram_id,
        `✅ approved. $${ticker} is live.\n\n` +
        `CA: \`${tokenAddress}\`\n` +
        `pump to $${thresholdK}k mc to unlock @${creator.telegram_username ?? creator.twitter_username}'s DMs.\n\n` +
        `verified by @gatekeepfunbot · ${shortCa}\n` +
        `${tokenUrl}`,
        { parse_mode: 'Markdown' },
      );
    } catch {}
  } catch (err) {
    console.error('[approve] launch failed:', err);
    await decideRequest(requestId, 'rejected');
    try {
      await ctx.api.sendMessage(
        req.creator_telegram_id,
        `❌ $${ticker} launch failed. fan can try /request again.`,
      );
    } catch {}
  }
}
