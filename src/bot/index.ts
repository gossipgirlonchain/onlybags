import { Bot } from 'grammy';
import { setupCommand, handleSetupInput } from './commands/setup';
import { requestCommand } from './commands/request';
import { handleEditTickerInput, handleRequestCallback } from './commands/approve';
import { statusCommand } from './commands/status';
import { verifyCommand } from './commands/verify';

export const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

bot.command('setup', setupCommand);
bot.command('request', requestCommand);
bot.command('status', statusCommand);
bot.command('verify', verifyCommand);

bot.command('start', async (ctx) => {
  await ctx.reply(
    'welcome to GateKeep\n\n' +
    'creators:\n' +
    '/setup - connect your wallet\n' +
    '/status - your active gates\n\n' +
    'fans:\n' +
    '/request @creator [$TICKER] - propose a gate token\n' +
    '/verify $TICKER - confirm a token is real',
  );
});

bot.on('callback_query:data', async (ctx) => {
  const handled = await handleRequestCallback(ctx);
  if (!handled) {
    await ctx.answerCallbackQuery();
  }
});

bot.on('message:text', async (ctx) => {
  if (await handleEditTickerInput(ctx)) return;
  if (await handleSetupInput(ctx)) return;
});

export async function startBot() {
  console.log('Bot starting (long polling)...');
  bot.start();
}
