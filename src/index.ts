import 'dotenv/config';
import { initDB } from './db';
import { startBot } from './bot';
import { startPoller } from './poller';
import { startWebServer } from './web';

async function main() {
  console.log('OnlyBags starting...');

  await initDB();
  startPoller();
  startWebServer();

  if (process.env.WEBHOOK_URL) {
    // Production: use webhook (set via Telegram API)
    console.log(`Webhook mode: ${process.env.WEBHOOK_URL}/webhook`);
  } else {
    // Dev: use long polling
    await startBot();
  }

  console.log('OnlyBags is live ✓');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
