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
      twitter_username TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      launch_id TEXT UNIQUE NOT NULL,
      chat_id BIGINT UNIQUE NOT NULL,
      creator_telegram_id BIGINT NOT NULL REFERENCES creators(telegram_user_id),
      fan_telegram_id BIGINT,
      fan_username TEXT,
      fan_wallet_address TEXT,
      ticker TEXT NOT NULL,
      token_address TEXT,
      threshold_usd INTEGER NOT NULL,
      current_mc_usd NUMERIC(20, 2) DEFAULT 0,
      unlocked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      launched_at TIMESTAMPTZ,
      unlocked_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_unlocked ON chats(unlocked) WHERE unlocked = FALSE;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chats_creator ON chats(creator_telegram_id);
  `);

  // Migration: drop legacy column if it exists
  await pool.query(`
    ALTER TABLE creators DROP COLUMN IF EXISTS encrypted_private_key;
  `);

  // Migration: add twitter_username if missing
  await pool.query(`
    ALTER TABLE creators ADD COLUMN IF NOT EXISTS twitter_username TEXT;
  `);

  // Migrations
  await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS fan_wallet_address TEXT;`);
  // Migration: Doppler migration — add launch_id, rename token_mint, make nullable
  await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS launch_id TEXT;`);
  await pool.query(`ALTER TABLE chats ADD COLUMN IF NOT EXISTS token_address TEXT;`);
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'token_mint')
        AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'token_address_migrated') THEN
        UPDATE chats SET token_address = token_mint WHERE token_address IS NULL AND token_mint IS NOT NULL;
      END IF;
    END $$;
  `);

  console.log('Database initialized');
}
