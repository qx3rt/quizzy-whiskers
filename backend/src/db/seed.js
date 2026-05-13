import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAllQuery, runQuery, saveDatabase } from './database.js';
import { createMultipleClues } from '../models/clues.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CATEGORIES = [
  { name: 'Final Jeopardy',   slug: 'final-jeopardy',   description: 'Final Jeopardy clues from various categories' },
  { name: 'Literature',        slug: 'literature',        description: 'Literature clues from various works' },
  { name: 'Poetry',            slug: 'poetry',            description: 'Poetry clues from various poets and works' },
  { name: 'Shakespeare',       slug: 'shakespeare',       description: 'Works and characters from William Shakespeare' },
  { name: 'Charles Dickens',   slug: 'charles-dickens',   description: 'Novels and characters from Charles Dickens' },
  { name: 'Jane Austen',       slug: 'jane-austen',       description: 'Novels and characters from Jane Austen' },
  { name: 'Broadway',          slug: 'broadway',          description: 'Broadway shows, musicals, and theater' },
  { name: 'Opera',             slug: 'opera',             description: 'Opera history, composers, and famous arias' },
  { name: 'Ballet',            slug: 'ballet',            description: 'Ballet history, choreographers, and famous works' },
  { name: 'Classical Music',   slug: 'classical-music',   description: 'Classical composers and their masterpieces' },
  { name: 'Television',        slug: 'television',        description: 'TV shows, characters, and history' },
  { name: 'Movies',            slug: 'movies',            description: 'Films, directors, and cinema history' },
  { name: 'Disney',            slug: 'disney',            description: 'Disney movies, characters, and parks' },
  { name: 'Music',             slug: 'music',             description: 'Music across genres and eras' },
  { name: 'Art & Artists',     slug: 'art-and-artists',   description: 'Visual art, paintings, and famous artists' },
  { name: 'Architecture',      slug: 'architecture',      description: 'Famous buildings, architects, and styles' },
  { name: 'Mythology',         slug: 'mythology',         description: 'Greek, Roman, and world mythology' },
  { name: 'Philosophy',        slug: 'philosophy',        description: 'Philosophers, schools of thought, and ideas' },
  { name: 'Bible',             slug: 'bible',             description: 'Biblical stories, figures, and scripture' },
  { name: 'History',           slug: 'history',           description: 'World history events and figures' },
  { name: 'Presidents',        slug: 'presidents',        description: 'US Presidents and presidential history' },
  { name: 'War',               slug: 'war',               description: 'Wars, battles, and military history' },
  { name: 'Nobel Prize',       slug: 'nobel-prize',       description: 'Nobel Prize winners and their achievements' },
  { name: 'Geography',         slug: 'geography',         description: 'Countries, cities, and world geography' },
  { name: 'Capitals',          slug: 'capitals',          description: 'World capitals and major cities' },
  { name: 'Baseball',          slug: 'baseball',          description: 'Baseball players, teams, and history' },
  { name: 'Basketball',        slug: 'basketball',        description: 'Basketball players, teams, and history' },
  { name: 'Football',          slug: 'football',          description: 'Football players, teams, and history' },
  { name: 'Hockey',            slug: 'hockey',            description: 'Hockey players, teams, and history' },
  { name: 'Olympics',          slug: 'olympics',          description: 'Olympic games, athletes, and history' },
  { name: 'Soccer',            slug: 'soccer',            description: 'Soccer players, teams, and tournaments' },
  { name: 'Boxing',            slug: 'boxing',            description: 'Boxing matches, fighters, and championships' },
  { name: 'Horse Racing',      slug: 'horse-racing',      description: 'Horse racing events, horses, and jockeys' },
  { name: 'Golf',              slug: 'golf',              description: 'Golf tournaments, players, and history' },
  { name: 'Auto Racing',       slug: 'auto-racing',       description: 'Auto racing events, drivers, and history' },
  { name: 'Potent Potables',   slug: 'potent-potables',   description: 'Alcoholic beverages, cocktails, and drinks' },
  { name: 'Chemistry',         slug: 'chemistry',         description: 'Chemical elements, reactions, and scientists' },
  { name: 'Physics',           slug: 'physics',           description: 'Physics concepts, laws, and scientists' },
  { name: 'Biology',           slug: 'biology',           description: 'Life sciences, organisms, and biologists' },
  { name: 'Astronomy',         slug: 'astronomy',         description: 'Stars, planets, and space exploration' },
  { name: 'Business',          slug: 'business',          description: 'Business, economics, and famous companies' },
  { name: 'Technology',        slug: 'technology',        description: 'Technology, inventions, and innovators' },
];

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

// Syncs all categories from CATEGORIES list into the database.
// Skips any slug that already exists — safe to call on every startup.
// Returns the number of newly added categories.
export async function syncCategories() {
  const dataDir = resolveDataDir();
  let added = 0;
  let skipped = 0;

  for (const category of CATEGORIES) {
    const existing = getAllQuery('SELECT id FROM categories WHERE slug = ?', [category.slug]);
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const filePath = path.join(dataDir, `${category.slug}-study-clues.json`);
    if (!fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

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
    }

    console.log(`  ${category.name}: inserted ${formatted.length} clues`);
    added++;
  }

  if (added > 0) {
    saveDatabase();
  }

  const [{ count: catCount }] = getAllQuery('SELECT COUNT(*) as count FROM categories');
  const [{ count: clueCount }] = getAllQuery('SELECT COUNT(*) as count FROM clues');
  console.log(`✓ Sync complete: ${added} new, ${skipped} skipped (${catCount} categories, ${clueCount} clues total)`);
  return added;
}

// Kept for backwards compat with seedDatabase.js script
export const seedIfEmpty = syncCategories;
