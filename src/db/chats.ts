import { pool } from './index';

export interface Chat {
  id: number;
  launch_id: string;
  chat_id: number;
  creator_telegram_id: number;
  ticker: string;
  token_address: string | null;
  threshold_usd: number;
  current_mc_usd: number;
  unlocked: boolean;
  created_at: Date;
  launched_at: Date | null;
  unlocked_at: Date | null;
}

export async function getChatByLaunchId(launchId: string): Promise<Chat | null> {
  const { rows } = await pool.query(
    'SELECT * FROM chats WHERE launch_id = $1',
    [launchId],
  );
  return rows[0] ?? null;
}

export async function getLockedChats(): Promise<Chat[]> {
  const { rows } = await pool.query(
    'SELECT * FROM chats WHERE unlocked = FALSE AND token_address IS NOT NULL',
  );
  return rows;
}

export async function getChatsByCreator(creatorTelegramId: number): Promise<Chat[]> {
  const { rows } = await pool.query(
    'SELECT * FROM chats WHERE creator_telegram_id = $1 ORDER BY created_at DESC',
    [creatorTelegramId],
  );
  return rows;
}

export async function createChat(
  launchId: string,
  chatId: number,
  creatorTelegramId: number,
  ticker: string,
  thresholdUsd: number,
): Promise<Chat> {
  const { rows } = await pool.query(
    `INSERT INTO chats (launch_id, chat_id, creator_telegram_id, ticker, threshold_usd)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [launchId, chatId, creatorTelegramId, ticker, thresholdUsd],
  );
  return rows[0];
}

export async function setTokenAddress(launchId: string, tokenAddress: string): Promise<void> {
  await pool.query(
    'UPDATE chats SET token_address = $1, launched_at = NOW() WHERE launch_id = $2',
    [tokenAddress, launchId],
  );
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
