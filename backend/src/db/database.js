import pg from 'pg'

const { Pool } = pg

const dbUrl = process.env.NODE_ENV === 'test'
  ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL)
  : process.env.DATABASE_URL

if (dbUrl) {
  try {
    const { hostname } = new URL(dbUrl)
    console.log(`[db] connecting to ${hostname}`)
  } catch {
    console.log('[db] DATABASE_URL is set (unparseable)')
  }
} else {
  console.warn('[db] WARNING: DATABASE_URL is not set — falling back to default pg connection (localhost:5432)')
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS games_played (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      final_score INTEGER NOT NULL,
      round1_correct INTEGER DEFAULT 0,
      round1_incorrect INTEGER DEFAULT 0,
      round1_timed_out INTEGER DEFAULT 0,
      round2_correct INTEGER DEFAULT 0,
      round2_incorrect INTEGER DEFAULT 0,
      round2_timed_out INTEGER DEFAULT 0,
      final_jeopardy_correct INTEGER,
      topics TEXT,
      played_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE TABLE IF NOT EXISTS clues (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      round TEXT NOT NULL,
      value INTEGER NOT NULL,
      clue TEXT NOT NULL,
      response TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_groups (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_group_mappings (
      id SERIAL PRIMARY KEY,
      category_group_id INTEGER NOT NULL REFERENCES category_groups(id),
      cluebase_category TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS final_jeopardy (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      air_date TEXT,
      clue_text TEXT NOT NULL,
      response_text TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clues_category ON clues(category);
    CREATE INDEX IF NOT EXISTS idx_clues_round_value ON clues(round, value);
    CREATE INDEX IF NOT EXISTS idx_games_played_user ON games_played(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_cgm_category ON category_group_mappings(cluebase_category);
    CREATE INDEX IF NOT EXISTS idx_cgm_group ON category_group_mappings(category_group_id);
  `);

  // Strip Cluebase-specific columns that have NOT NULL constraints incompatible
  // with our schema. IF EXISTS makes these no-ops on fresh deployments.
  await pool.query(`
    ALTER TABLE clues DROP COLUMN IF EXISTS daily_double;
    ALTER TABLE clues DROP COLUMN IF EXISTS complete;
    ALTER TABLE clues DROP COLUMN IF EXISTS air_date;
    ALTER TABLE clues DROP COLUMN IF EXISTS season;
  `);
}

export async function closeDatabase() {
  await pool.end()
}

export async function getAllQuery(sql, params = []) {
  const result = await pool.query(sql, params)
  return result.rows
}

export async function getQuery(sql, params = []) {
  const result = await pool.query(sql, params)
  return result.rows[0] || null
}

export async function runQuery(sql, params = []) {
  return pool.query(sql, params)
}

export async function getClient() {
  return pool.connect()
}
