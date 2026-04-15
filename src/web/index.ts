import express from 'express';
import path from 'path';
import { bot } from '../bot';
import { webhookCallback } from 'grammy';
import { getChatByLaunchId } from '../db/chats';

export function startWebServer() {
  const app = express();
  const port = parseInt(process.env.PORT ?? '3000');

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../../public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
  });

  // Token metadata for Doppler
  app.get('/api/metadata/:id', async (req, res) => {
    const chat = await getChatByLaunchId(req.params.id);
    if (!chat) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    res.json({
      name: `${chat.ticker} Pass`,
      symbol: chat.ticker.toUpperCase(),
      description: `Unlock DMs. Pump $${chat.ticker.toUpperCase()} to reach the threshold.`,
      external_url: 'https://gatekeep.fun',
      image: 'https://gatekeep.fun/default-token-image.png',
    });
  });

  if (process.env.WEBHOOK_URL) {
    app.use('/webhook', webhookCallback(bot, 'express'));
  }

  app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
  });
}
