import { Context } from 'grammy';
import { attachFanToChat, getChatByLaunchId } from '../../db/chats';
import { getCreator } from '../../db/creators';

const WELCOME =
  'welcome to GateKeep\n\n' +
  'creators:\n' +
  '/setup - connect your wallet\n' +
  '/lock @fan [$TICKER] - gate a dm with a token\n' +
  '/status - your active gates\n\n' +
  'anyone:\n' +
  '/verify $TICKER - confirm a token is real';

export async function startCommand(ctx: Context) {
  const text = ctx.message?.text ?? '';
  const param = text.replace(/^\/start(?:@\w+)?\s*/i, '').trim();

  if (!param.startsWith('lock_')) {
    await ctx.reply(WELCOME);
    return;
  }

  const launchId = param.slice('lock_'.length);
  const fanId = ctx.from?.id;
  const fanUsername = ctx.from?.username ?? null;
  if (!fanId) return;

  const chat = await getChatByLaunchId(launchId);
  if (!chat) {
    await ctx.reply("that lock doesn't exist or has expired.");
    return;
  }

  const creator = await getCreator(chat.creator_telegram_id);
  const creatorLabel = creator
    ? `@${creator.telegram_username ?? creator.twitter_username}`
    : 'the creator';

  if (chat.unlocked) {
    await ctx.reply(
      `🔓 $${chat.ticker} already unlocked. ${creatorLabel} can DM you any time.`,
    );
    return;
  }

  // Bind to the @username the creator typed at /lock time
  if (chat.fan_username && fanUsername && chat.fan_username.toLowerCase() !== fanUsername.toLowerCase()) {
    await ctx.reply(
      `this lock was created for @${chat.fan_username}, not @${fanUsername}. ` +
      `if this is meant for you, ask the creator to /lock again with your real handle.`,
    );
    return;
  }
  if (chat.fan_username && !fanUsername) {
    await ctx.reply(
      `this lock was created for @${chat.fan_username}. ` +
      `set a public username on your telegram account so i can verify you.`,
    );
    return;
  }

  const attached = await attachFanToChat(launchId, fanId, fanUsername);
  if (!attached && chat.fan_telegram_id && chat.fan_telegram_id !== fanId) {
    await ctx.reply('this lock has already been claimed by someone else.');
    return;
  }

  const thresholdK = chat.threshold_usd / 1000;
  const tokenUrl = chat.token_address ? `app.doppler.lol/tokens/${chat.token_address}` : '';

  await ctx.reply(
    `🔒 you're tracking $${chat.ticker}\n\n` +
    `creator: ${creatorLabel}\n` +
    `unlock at: $${thresholdK}k mc\n` +
    (chat.token_address ? `CA: \`${chat.token_address}\`\n` : '') +
    (tokenUrl ? `${tokenUrl}\n` : '') +
    `\ni'll DM you the moment $${chat.ticker} hits $${thresholdK}k.`,
    { parse_mode: 'Markdown' },
  );
}
