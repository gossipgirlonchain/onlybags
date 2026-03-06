import express from 'express';
import path from 'path';
import { bot } from '../bot';
import { webhookCallback } from 'grammy';

export function startWebServer() {
  const app = express();
  const port = parseInt(process.env.PORT ?? '3000');

  // Serve landing page and static assets
  app.use(express.static(path.join(__dirname, '../../public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', uptime: process.uptime() });
  });

  // Telegram webhook endpoint (production)
  if (process.env.WEBHOOK_URL) {
    app.use('/webhook', express.json(), webhookCallback(bot, 'express'));
  }

  app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
  });
}
