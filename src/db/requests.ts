import { pool } from './index';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface Request {
  id: number;
  fan_telegram_id: number;
  fan_username: string | null;
  creator_telegram_id: number;
  proposed_ticker: string;
  threshold_usd: number;
  status: RequestStatus;
  created_at: Date;
  decided_at: Date | null;
  launch_id: string | null;
}

export async function createRequest(
  fanTelegramId: number,
  fanUsername: string | null,
  creatorTelegramId: number,
  proposedTicker: string,
  thresholdUsd: number,
): Promise<Request> {
  const { rows } = await pool.query(
    `INSERT INTO requests
       (fan_telegram_id, fan_username, creator_telegram_id, proposed_ticker, threshold_usd)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fanTelegramId, fanUsername, creatorTelegramId, proposedTicker, thresholdUsd],
  );
  return rows[0];
}

export async function getRequest(id: number): Promise<Request | null> {
  const { rows } = await pool.query('SELECT * FROM requests WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function setRequestTicker(id: number, ticker: string): Promise<void> {
  await pool.query('UPDATE requests SET proposed_ticker = $1 WHERE id = $2', [ticker, id]);
}

export async function decideRequest(
  id: number,
  status: 'approved' | 'rejected',
  launchId?: string,
): Promise<void> {
  await pool.query(
    `UPDATE requests
       SET status = $1, decided_at = NOW(), launch_id = COALESCE($2, launch_id)
     WHERE id = $3`,
    [status, launchId ?? null, id],
  );
}

export async function isTickerTaken(ticker: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM chats WHERE UPPER(ticker) = UPPER($1) LIMIT 1`,
    [ticker],
  );
  return rows.length > 0;
}

export async function getChatByTicker(ticker: string) {
  const { rows } = await pool.query(
    `SELECT * FROM chats WHERE UPPER(ticker) = UPPER($1) LIMIT 1`,
    [ticker],
  );
  return rows[0] ?? null;
}
