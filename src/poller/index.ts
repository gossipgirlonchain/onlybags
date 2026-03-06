import cron from 'node-cron';
import { getLockedChats, updateChatMC, markChatUnlocked } from '../db/chats';
import { getTokenMarketCapUsd } from '../bags/mc';
import { bot } from '../bot';

export function startPoller() {
  console.log('MC poller started (every 30s)');

  cron.schedule('*/30 * * * * *', async () => {
    const lockedChats = await getLockedChats();
    if (lockedChats.length === 0) return;

    console.log(`[poller] Checking ${lockedChats.length} locked chat(s)`);

    for (const chat of lockedChats) {
      try {
        const mc = await getTokenMarketCapUsd(chat.token_mint);
        await updateChatMC(chat.chat_id, mc);

        if (mc >= chat.threshold_usd) {
          await markChatUnlocked(chat.chat_id);

          const thresholdK = chat.threshold_usd / 1000;
          const mcK = (mc / 1000).toFixed(0);

          await bot.api.sendMessage(
            chat.chat_id,
            `🔓 threshold hit! $${chat.ticker} reached $${mcK}k\n\nDMs are now open. Send a message!`,
          );

          // Also notify the creator
          try {
            await bot.api.sendMessage(
              chat.creator_telegram_id,
              `🔓 $${chat.ticker} hit $${mcK}k — chat unlocked!\n\n` +
              `bags.fm/${chat.token_mint}`,
            );
          } catch {}

          console.log(`[poller] Chat ${chat.chat_id} unlocked at MC $${mc}`);
        }
      } catch (err) {
        console.error(`[poller] Error for chat ${chat.chat_id}:`, err);
      }
    }
  });
}
