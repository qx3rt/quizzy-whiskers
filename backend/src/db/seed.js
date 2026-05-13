import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllQuery, runQuery, saveDatabase } from './database.js';
import { createMultipleClues } from '../models/clues.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATEGORIES = [
  { name: 'Shakespeare', slug: 'shakespeare', description: 'Works and characters from William Shakespeare' },
  { name: 'Charles Dickens', slug: 'charles-dickens', description: 'Novels and characters from Charles Dickens' },
  { name: 'Opera', slug: 'opera', description: 'Opera history, composers, and famous arias' },
  { name: 'Classical Music', slug: 'classical-music', description: 'Classical composers and their masterpieces' },
  { name: 'Final Jeopardy', slug: 'final-jeopardy', description: 'Final Jeopardy clues from various categories' },
  { name: 'Jane Austen', slug: 'jane-austen', description: 'Novels and characters from Jane Austen' },
];

const DATA_FILES = {
  'shakespeare': 'shakespeare-study-clues.json',
  'charles-dickens': 'charles-dickens-study-clues.json',
  'opera': 'opera-study-clues.json',
  'classical-music': 'classical-music-study-clues.json',
  'final-jeopardy': 'final-jeopardy-study-clues.json',
  'jane-austen': 'jane-austen-study-clues.json',
};

// Resolve the processed data directory relative to this file's location,
// with a fallback to the DATA_DIR env var for deployment environments where
// the JSON files live outside the repo (e.g. mounted volume on Railway/Render).
function resolveDataDir() {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }
  return path.resolve(__dirname, '../../data/processed');
}

function loadCluesFromFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    console.warn(`  Could not read ${filePath} — skipping`);
    return [];
  }
}

// Returns true if seeding happened, false if the DB was already seeded.
export async function seedIfEmpty() {
  const existing = getAllQuery('SELECT id FROM categories LIMIT 1');
  if (existing.length > 0) {
    return false;
  }

  console.log('Empty database detected — seeding…');
  const dataDir = resolveDataDir();

  for (const category of CATEGORIES) {
    runQuery(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [category.name, category.slug, category.description]
    );

    const rows = getAllQuery('SELECT id FROM categories WHERE slug = ?', [category.slug]);
    const categoryId = rows[0]?.id;
    if (!categoryId) {
      console.error(`  Failed to insert category: ${category.name}`);
      continue;
    }

    const fileName = DATA_FILES[category.slug];
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`  File not found: ${filePath}`);
      continue;
    }

    const cluesData = loadCluesFromFile(filePath);
    const formatted = cluesData.map(c => ({
      clue_text: c.clue,
      response_text: c.response,
      category_id: categoryId,
      difficulty_level: 1,
      source: 'trivial-studies',
    }));

    if (formatted.length > 0) {
      createMultipleClues(formatted);
      console.log(`  ${category.name}: inserted ${formatted.length} clues`);
    }
  }

  saveDatabase();

  const [{ count: catCount }] = getAllQuery('SELECT COUNT(*) as count FROM categories');
  const [{ count: clueCount }] = getAllQuery('SELECT COUNT(*) as count FROM clues');
  console.log(`✓ Seeded ${catCount} categories, ${clueCount} clues`);
  return true;
}
