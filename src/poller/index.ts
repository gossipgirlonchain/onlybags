import cron from 'node-cron';
import { getLockedChats, updateChatMC, markChatUnlocked } from '../db/chats';
import { getTokenMarketCapUsd } from '../doppler/mc';
import { bot } from '../bot';

export function startPoller() {
  console.log('MC poller started (every 30s)');

  cron.schedule('*/30 * * * * *', async () => {
    const lockedChats = await getLockedChats();
    if (lockedChats.length === 0) return;

    console.log(`[poller] Checking ${lockedChats.length} locked chat(s)`);

    for (const chat of lockedChats) {
      if (!chat.token_address) continue;

      try {
        const mc = await getTokenMarketCapUsd(chat.token_address);
        await updateChatMC(chat.chat_id, mc);

        if (mc >= chat.threshold_usd) {
          await markChatUnlocked(chat.chat_id);
          const mcK = (mc / 1000).toFixed(0);
          const fanLabel = chat.fan_username ? `@${chat.fan_username}` : 'fan';
          const tokenUrl = `app.doppler.lol/tokens/${chat.token_address}`;

          try {
            await bot.api.sendMessage(
              chat.creator_telegram_id,
              `🔓 $${chat.ticker} hit $${mcK}k\n\n` +
              `${fanLabel} unlocked your DMs. you can reply now.\n` +
              `${tokenUrl}`,
            );
          } catch {}

          if (chat.fan_telegram_id) {
            try {
              await bot.api.sendMessage(
                chat.fan_telegram_id,
                `🔓 $${chat.ticker} hit $${mcK}k. you're in — DM the creator now.\n` +
                `${tokenUrl}`,
              );
            } catch {}
          }

          console.log(`[poller] Chat ${chat.chat_id} unlocked at MC $${mc}`);
        }
      } catch (err) {
        console.error(`[poller] Error for chat ${chat.chat_id}:`, err);
      }
    }
  });
}
