import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/app.db');
const DATA_DIR = path.join(__dirname, '../../data');

let db;
let SQL;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function initializeDatabase() {
  SQL = await initSqlJs();

  // Load existing database if it exists
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
    console.log('Loaded existing database from', dbPath);
  } else {
    db = new SQL.Database();
    console.log('Created new database at', dbPath);
  }

  // Create schema
  const schema = `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      topic_area TEXT,
      season INTEGER,
      air_date TEXT,
      round TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clue_text TEXT NOT NULL,
      response_text TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      difficulty_level INTEGER DEFAULT 1,
      dollar_value INTEGER,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS clue_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      source_url TEXT,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      final_score INTEGER NOT NULL,
      round1_correct INTEGER DEFAULT 0,
      round1_incorrect INTEGER DEFAULT 0,
      round1_timed_out INTEGER DEFAULT 0,
      round2_correct INTEGER DEFAULT 0,
      round2_incorrect INTEGER DEFAULT 0,
      round2_timed_out INTEGER DEFAULT 0,
      final_jeopardy_correct INTEGER,
      topics TEXT,
      played_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL REFERENCES users(id),
      achievement_id INTEGER NOT NULL REFERENCES achievements(id),
      earned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, achievement_id)
    );

    CREATE INDEX IF NOT EXISTS idx_clues_category ON clues(category_id);
    CREATE INDEX IF NOT EXISTS idx_clues_difficulty ON clues(difficulty_level);
    CREATE INDEX IF NOT EXISTS idx_categories_topic ON categories(topic_area);
    CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
  `;

  // Execute schema
  schema.split(';').forEach(statement => {
    if (statement.trim()) {
      db.run(statement);
    }
  });

  saveDatabase();
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
  }
}

// Utility to run queries
export function runQuery(sql, params = []) {
  const db = getDatabase();
  try {
    db.run(sql, params);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('Query error:', error);
    return { success: false, error: error.message };
  }
}

// Utility to get all results
export function getAllQuery(sql, params = []) {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error('Query error:', error);
    return [];
  }
}

// Utility to get one result
export function getQuery(sql, params = []) {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    let result = null;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  } catch (error) {
    console.error('Query error:', error);
    return null;
  }
}
