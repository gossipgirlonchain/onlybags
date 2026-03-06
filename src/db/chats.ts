import { pool } from './index';

export interface Chat {
  id: number;
  chat_id: number;
  creator_telegram_id: number;
  fan_telegram_id: number | null;
  fan_username: string | null;
  ticker: string;
  token_mint: string;
  threshold_usd: number;
  current_mc_usd: number;
  unlocked: boolean;
  launched_at: Date;
  unlocked_at: Date | null;
}

export async function getChatByChatId(chatId: number): Promise<Chat | null> {
  const { rows } = await pool.query(
    'SELECT * FROM chats WHERE chat_id = $1',
    [chatId],
  );
  return rows[0] ?? null;
}

export async function getLockedChats(): Promise<Chat[]> {
  const { rows } = await pool.query(
    'SELECT * FROM chats WHERE unlocked = FALSE',
  );
  return rows;
}

export async function getChatsByCreator(creatorTelegramId: number): Promise<Chat[]> {
  const { rows } = await pool.query(
    'SELECT * FROM chats WHERE creator_telegram_id = $1 ORDER BY launched_at DESC',
    [creatorTelegramId],
  );
  return rows;
}

export async function createChat(
  chatId: number,
  creatorTelegramId: number,
  fanTelegramId: number | null,
  fanUsername: string | null,
  ticker: string,
  tokenMint: string,
  thresholdUsd: number,
): Promise<Chat> {
  const { rows } = await pool.query(
    `INSERT INTO chats (chat_id, creator_telegram_id, fan_telegram_id, fan_username, ticker, token_mint, threshold_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [chatId, creatorTelegramId, fanTelegramId, fanUsername, ticker, tokenMint, thresholdUsd],
  );
  return rows[0];
}

export async function updateChatMC(chatId: number, mcUsd: number): Promise<void> {
  await pool.query(
    'UPDATE chats SET current_mc_usd = $1 WHERE chat_id = $2',
    [mcUsd, chatId],
  );
}

export async function markChatUnlocked(chatId: number): Promise<void> {
  await pool.query(
    'UPDATE chats SET unlocked = TRUE, unlocked_at = NOW() WHERE chat_id = $1',
    [chatId],
  );
}
