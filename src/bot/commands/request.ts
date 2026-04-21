import { Context, InlineKeyboard } from 'grammy';
import { getCreator, getCreatorByUsername } from '../../db/creators';
import { createRequest, isTickerTaken } from '../../db/requests';
import {
  containsCreatorSubstring,
  defaultTicker,
  normalizeTicker,
  validateTickerShape,
} from '../../utils/ticker';

const DEFAULT_THRESHOLD_USD = 5000;

function approvalKeyboard(requestId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('Approve', `req:approve:${requestId}`)
    .text('Edit ticker', `req:edit:${requestId}`)
    .text('Reject', `req:reject:${requestId}`);
}

export async function requestCommand(ctx: Context) {
  const fanId = ctx.from?.id;
  const fanUsername = ctx.from?.username ?? null;
  if (!fanId) return;

  if (ctx.chat?.type !== 'private') {
    await ctx.reply('DM me to request access: @gatekeepfunbot');
    return;
  }

  const text = ctx.message?.text ?? '';
  const args = text.replace(/^\/request(?:@\w+)?\s*/i, '').trim();

  if (!args) {
    await ctx.reply(
      'usage: /request @creator [$TICKER]\n\n' +
      'examples:\n' +
      '/request @winternet $WINPLZ\n' +
      '/request @winternet  (auto-named)',
    );
    return;
  }

  const parts = args.split(/\s+/);
  const handleArg = parts[0].replace(/^@/, '');
  const tickerArg = parts[1] ? normalizeTicker(parts[1]) : null;

  if (!handleArg) {
    await ctx.reply('who do you want to DM? /request @username');
    return;
  }

  const creator = await getCreatorByUsername(handleArg);
  if (!creator) {
    await ctx.reply(
      `@${handleArg} hasn't set up GateKeep yet. ` +
      `tell them to DM @gatekeepfunbot and run /setup`,
    );
    return;
  }

  if (creator.telegram_user_id === fanId) {
    await ctx.reply("you can't request access to your own DMs");
    return;
  }

  const proposed = tickerArg ?? defaultTicker(creator.twitter_username, fanUsername ?? `fan${fanId}`);

  const shape = validateTickerShape(proposed);
  if (!shape.ok) {
    await ctx.reply(
      `ticker $${proposed} invalid: ${shape.reason}\n\n` +
      `try /request @${handleArg} $YOURIDEA`,
    );
    return;
  }

  if (tickerArg && !containsCreatorSubstring(proposed, creator.twitter_username)) {
    await ctx.reply(
      `ticker $${proposed} doesn't reference @${creator.twitter_username}.\n\n` +
      `must contain at least 3 consecutive chars from their handle ` +
      `(e.g. include "${creator.twitter_username.slice(0, 3).toUpperCase()}").\n` +
      `the creator can override this during approval.`,
    );
    return;
  }

  if (await isTickerTaken(proposed)) {
    await ctx.reply(
      `$${proposed} is already in use on GateKeep. propose a different one.\n` +
      `/request @${handleArg} $ANOTHERIDEA`,
    );
    return;
  }

  const req = await createRequest(
    fanId,
    fanUsername,
    creator.telegram_user_id,
    proposed,
    DEFAULT_THRESHOLD_USD,
  );

  await ctx.reply(
    `request sent to @${creator.telegram_username ?? creator.twitter_username}\n\n` +
    `proposed ticker: $${proposed}\n` +
    `unlock threshold: $${(DEFAULT_THRESHOLD_USD / 1000).toFixed(0)}k mc\n\n` +
    `you'll be notified when they decide.`,
  );

  const fanLabel = fanUsername ? `@${fanUsername}` : `telegram user ${fanId}`;
  try {
    await ctx.api.sendMessage(
      creator.telegram_user_id,
      `${fanLabel} wants access to your DMs.\n\n` +
      `proposed ticker: $${proposed}\n` +
      `unlock threshold: $${(DEFAULT_THRESHOLD_USD / 1000).toFixed(0)}k mc`,
      { reply_markup: approvalKeyboard(req.id) },
    );
  } catch (err) {
    console.error('[request] failed to notify creator:', err);
    await ctx.reply(
      "couldn't notify the creator (they may have blocked the bot). " +
      'request is saved — they can run /status to see it.',
    );
  }
}
