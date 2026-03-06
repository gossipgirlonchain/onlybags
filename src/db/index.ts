import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS creators (
      id SERIAL PRIMARY KEY,
      telegram_user_id BIGINT UNIQUE NOT NULL,
      telegram_username TEXT,
      wallet_address TEXT NOT NULL,
      encrypted_private_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      chat_id BIGINT UNIQUE NOT NULL,
      creator_telegram_id BIGINT NOT NULL REFERENCES creators(telegram_user_id),
      fan_telegram_id BIGINT,
      fan_username TEXT,
      ticker TEXT NOT NULL,
      token_mint TEXT NOT NULL,
      threshold_usd INTEGER NOT NULL,
      current_mc_usd NUMERIC(20, 2) DEFAULT 0,
      unlocked BOOLEAN DEFAULT FALSE,
      launched_at TIMESTAMPTZ DEFAULT NOW(),
      unlocked_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_unlocked ON chats(unlocked) WHERE unlocked = FALSE;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_creator ON chats(creator_telegram_id);
  `);

  console.log('Database initialized');
}
