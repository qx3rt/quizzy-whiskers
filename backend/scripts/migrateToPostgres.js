/**
 * One-time migration script — run after importing Cluebase's SQL dump.
 *
 * Prerequisites:
 *   1. DATABASE_URL points to a PostgreSQL instance that already has Cluebase's
 *      tables loaded (psql $DATABASE_URL < jeopardy201908021145.sql)
 *   2. backend/.env has DATABASE_URL set
 *
 * Usage (from repo root):
 *   node backend/scripts/migrateToPostgres.js
 *
 * Idempotent — safe to re-run.
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import pg from 'pg'

const { Pool } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// ---------------------------------------------------------------------------
// Topic rules extracted from scripts/importJeopardy.mjs
// ---------------------------------------------------------------------------
const TOPIC_RULES = [
  { topic: 'shakespeare',  display: 'Shakespeare',   keywords: ['SHAKESPEARE'] },
  { topic: 'dickens',      display: 'Dickens',        keywords: ['DICKENS'] },
  { topic: 'twain',        display: 'Mark Twain',     keywords: ['MARK TWAIN', 'TWAIN'] },
  { topic: 'austen',       display: 'Jane Austen',    keywords: ['JANE AUSTEN', 'AUSTEN'] },
  { topic: 'hemingway',    display: 'Hemingway',      keywords: ['HEMINGWAY'] },
  { topic: 'poe',          display: 'Edgar Allan Poe',keywords: [' POE '] },
  { topic: 'poetry',       display: 'Poetry',         keywords: ['POETRY', ' POEMS', 'POEM '] },
  { topic: 'literature',   display: 'Literature',     keywords: ['LITERATURE', 'NOVELS', ' NOVEL ', 'AUTHORS', ' AUTHOR ', 'FICTION', 'LITERARY'] },
  { topic: 'broadway',     display: 'Broadway',       keywords: ['BROADWAY', 'MUSICAL', 'MUSICALS', 'TONY AWARD', 'TONY AWARDS'] },
  { topic: 'opera',        display: 'Opera',          keywords: ['OPERA', 'OPERAS'] },
  { topic: 'ballet',       display: 'Ballet',         keywords: ['BALLET'] },
  { topic: 'classical',    display: 'Classical Music',keywords: ['CLASSICAL MUSIC', 'SYMPHONY', 'SYMPHONIES', 'COMPOSER', 'COMPOSERS', 'BEETHOVEN', 'MOZART', 'BACH'] },
  { topic: 'movies',       display: 'Movies',         keywords: ['MOVIE', 'MOVIES', 'FILM', 'FILMS', 'CINEMA', 'OSCAR', 'OSCARS', 'DIRECTOR', 'DIRECTORS', 'ACTOR', 'ACTRESS', 'ANIMATED FILM', 'BOX OFFICE'] },
  { topic: 'television',   display: 'Television',     keywords: ['TELEVISION', ' TV ', 'SITCOM', 'SITCOMS', 'EMMY', 'EMMYS', 'GAME SHOW', 'TALK SHOW', 'TV SHOW', 'SOAP OPERA'] },
  { topic: 'disney',       display: 'Disney',         keywords: ['DISNEY'] },
  { topic: 'music',        display: 'Music',          keywords: ['MUSIC', 'SONGS', ' SONG ', 'SINGER', 'SINGERS', 'BAND ', 'BANDS', 'ALBUM', 'ALBUMS', 'ROCK AND ROLL', "ROCK 'N' ROLL", 'JAZZ', 'BLUES', 'COUNTRY MUSIC', 'HIP HOP', 'RAP ', 'POP MUSIC'] },
  { topic: 'art',          display: 'Art',            keywords: ['PAINTING', 'PAINTINGS', 'SCULPTURE', 'SCULPTOR', 'MUSEUM', 'MUSEUMS', 'ARTIST', 'ARTISTS', 'FINE ART', 'MASTERPIECE'] },
  { topic: 'architecture', display: 'Architecture',   keywords: ['ARCHITECTURE', 'ARCHITECT', 'BUILDING', 'BUILDINGS', 'LANDMARK', 'LANDMARKS'] },
  { topic: 'presidents',   display: 'Presidents',     keywords: ['PRESIDENT', 'PRESIDENTS', 'WHITE HOUSE', 'COMMANDER IN CHIEF'] },
  { topic: 'royalty',      display: 'Royalty',        keywords: ['KING ', 'QUEEN ', 'KINGS ', 'QUEENS ', 'ROYALTY', 'MONARCHY', 'CROWN'] },
  { topic: 'war',          display: 'War & Military', keywords: ['WAR ', ' WAR', 'WARS', 'BATTLE', 'BATTLES', 'MILITARY', 'WWII', 'WWI', 'CIVIL WAR', 'REVOLUTION'] },
  { topic: 'history',      display: 'History',        keywords: ['HISTORY', 'HISTORICAL', 'ANCIENT', 'MEDIEVAL', 'CENTURY', 'EMPIRE', 'CIVILIZATION'] },
  { topic: 'politics',     display: 'Politics',       keywords: ['POLITICS', 'POLITICAL', 'CONGRESS', 'SENATE', 'SUPREME COURT', 'ELECTION', 'CONSTITUTION'] },
  { topic: 'mythology',    display: 'Mythology',      keywords: ['MYTHOLOGY', 'MYTH', 'GODS', 'GODDESSES', 'GREEK GODS', 'ROMAN GODS', 'NORSE', 'GREEK HEROES', 'OLYMPUS'] },
  { topic: 'bible',        display: 'The Bible',      keywords: ['BIBLE', 'BIBLICAL', 'TESTAMENT', 'SCRIPTURE', 'GOSPEL', 'APOSTLE', 'PROPHET'] },
  { topic: 'religion',     display: 'Religion',       keywords: ['RELIGION', 'RELIGIOUS', 'CHURCH', 'CHRISTIANITY', 'ISLAM', 'JUDAISM', 'BUDDHISM', 'HINDUISM'] },
  { topic: 'philosophy',   display: 'Philosophy',     keywords: ['PHILOSOPHY', 'PHILOSOPHER', 'PHILOSOPHERS', 'ETHICS'] },
  { topic: 'astronomy',    display: 'Astronomy',      keywords: ['ASTRONOMY', 'ASTRONOMERS', 'PLANET', 'PLANETS', 'STARS', 'GALAXY', 'SPACE', 'NASA', 'CONSTELLATION', 'COMET', 'TELESCOPE'] },
  { topic: 'biology',      display: 'Biology',        keywords: ['BIOLOGY', 'ANIMAL', 'ANIMALS', 'MAMMAL', 'MAMMALS', 'BIRDS', 'INSECTS', 'PLANTS', 'BOTANY', 'SPECIES', 'EVOLUTION', 'DNA'] },
  { topic: 'chemistry',    display: 'Chemistry',      keywords: ['CHEMISTRY', 'ELEMENTS', 'CHEMICAL', 'PERIODIC TABLE', 'MOLECULE', 'COMPOUND'] },
  { topic: 'physics',      display: 'Physics',        keywords: ['PHYSICS', 'PHYSICISTS', 'QUANTUM', 'RELATIVITY', 'GRAVITY', 'ENERGY'] },
  { topic: 'science',      display: 'Science',        keywords: ['SCIENCE', 'SCIENTIST', 'SCIENTISTS', 'INVENTION', 'INVENTIONS', 'INVENTOR', 'INVENTORS', 'DISCOVERY', 'DISCOVERIES', 'LABORATORY', 'EXPERIMENT', 'NOBEL PRIZE'] },
  { topic: 'medicine',     display: 'Medicine',       keywords: ['MEDICINE', 'MEDICAL', 'DOCTOR', 'ANATOMY', 'DISEASE', 'SURGERY', 'PHARMACY'] },
  { topic: 'geography',    display: 'Geography',      keywords: ['GEOGRAPHY', 'GEOGRAPHICAL', 'CONTINENT', 'CONTINENTS', 'OCEAN', 'OCEANS', 'RIVER', 'RIVERS', 'MOUNTAIN', 'MOUNTAINS', 'LAKE', 'LAKES', 'DESERT', 'ISLAND', 'ISLANDS', 'PENINSULA'] },
  { topic: 'capitals',     display: 'World Capitals', keywords: ['CAPITAL', 'CAPITALS', 'CAPITAL CITY', 'CAPITAL CITIES'] },
  { topic: 'countries',    display: 'Countries',      keywords: ['COUNTRY', 'COUNTRIES', 'NATION', 'NATIONS', 'FLAG', 'FLAGS'] },
  { topic: 'us-states',    display: 'U.S. States',    keywords: ['U.S. STATE', 'U.S. STATES', 'AMERICAN STATE', 'STATE CAPITAL', 'THE GREAT STATE'] },
  { topic: 'cities',       display: 'Cities',         keywords: ['CITY', 'CITIES'] },
  { topic: 'baseball',     display: 'Baseball',       keywords: ['BASEBALL', 'WORLD SERIES', 'MLB'] },
  { topic: 'football',     display: 'Football',       keywords: ['FOOTBALL', 'NFL', 'SUPER BOWL', 'QUARTERBACK'] },
  { topic: 'basketball',   display: 'Basketball',     keywords: ['BASKETBALL', 'NBA', 'MARCH MADNESS'] },
  { topic: 'hockey',       display: 'Hockey',         keywords: ['HOCKEY', 'NHL', 'STANLEY CUP'] },
  { topic: 'soccer',       display: 'Soccer',         keywords: ['SOCCER', 'WORLD CUP', 'FIFA', 'FOOTBALL CLUB'] },
  { topic: 'olympics',     display: 'Olympics',       keywords: ['OLYMPICS', 'OLYMPIC', 'OLYMPIAN', 'OLYMPIANS'] },
  { topic: 'golf',         display: 'Golf',           keywords: ['GOLF', 'GOLFER', 'GOLFERS', 'THE MASTERS', 'PGA'] },
  { topic: 'boxing',       display: 'Boxing',         keywords: ['BOXING', 'BOXER', 'BOXERS', 'HEAVYWEIGHT'] },
  { topic: 'tennis',       display: 'Tennis',         keywords: ['TENNIS', 'WIMBLEDON', 'US OPEN'] },
  { topic: 'sports',       display: 'Sports',         keywords: ['SPORTS', 'ATHLETE', 'ATHLETES', 'CHAMPION', 'CHAMPIONSHIP', 'HALL OF FAME', 'TROPHY', 'RACING', 'MARATHON'] },
  { topic: 'food',         display: 'Food & Drink',   keywords: ['FOOD', 'COOKING', 'CUISINE', 'CHEF', 'RECIPE', 'RESTAURANT', 'DISH', 'INGREDIENT', 'VEGETABLE', 'FRUIT', 'BREAD', 'CHEESE', 'SPICE', 'DESSERT', 'CAKE', 'WINE', 'BEER', 'COCKTAIL', 'BEVERAGE', 'POTENT POTABLE'] },
  { topic: 'business',     display: 'Business',       keywords: ['BUSINESS', 'COMPANY', 'COMPANIES', 'CORPORATION', 'STOCK MARKET', 'ECONOMY', 'ECONOMICS', 'FINANCE', 'BRAND', 'BRANDS', 'ENTREPRENEUR', 'CEO'] },
  { topic: 'technology',   display: 'Technology',     keywords: ['TECHNOLOGY', 'COMPUTER', 'COMPUTERS', 'INTERNET', 'SOFTWARE', 'APP', 'SILICON VALLEY', 'DIGITAL', 'ARTIFICIAL INTELLIGENCE'] },
  { topic: 'language',     display: 'Language & Words',keywords: ['LANGUAGE', 'LANGUAGES', 'WORD ', 'WORDS', 'VOCABULARY', 'GRAMMAR', 'LATIN ', 'ETYMOLOGY', 'SLANG', 'IDIOM'] },
  { topic: 'biography',    display: 'Biography',      keywords: ['BIOGRAPHY', 'LIFE OF ', 'BORN IN', 'FAMOUS '] },
]

const ACHIEVEMENTS = [
  { slug: 'first_game',            name: 'First Steps',       description: 'Complete your first game' },
  { slug: 'ten_games',             name: 'Getting Warmed Up', description: 'Play 10 games' },
  { slug: 'fifty_games',           name: 'Seasoned Contestant',description: 'Play 50 games' },
  { slug: 'century_club',          name: 'Century Club',      description: 'Play 100 games' },
  { slug: 'perfect_round',         name: 'Clean Sweep',       description: 'Answer all 5 clues in a round correctly with no misses or timeouts' },
  { slug: 'perfect_game',          name: 'Flawless Victory',  description: 'Complete both rounds with no incorrect answers or timeouts' },
  { slug: 'no_timeouts',           name: 'Quick Draw',        description: 'Finish a full game without any timeouts' },
  { slug: 'double_dominator',      name: 'Double Down',       description: 'Answer all Double Jeopardy clues correctly' },
  { slug: 'final_jeopardy_winner', name: 'Final Say',         description: 'Win Final Jeopardy!' },
  { slug: 'fj_regular',            name: 'Final Authority',   description: 'Win Final Jeopardy! 5 times' },
  { slug: 'high_roller',           name: 'High Roller',       description: 'Score $10,000 or more in a single game' },
  { slug: 'grand_champion',        name: 'Grand Champion',    description: 'Score $20,000 or more in a single game' },
  { slug: 'answer_machine',        name: 'Answer Machine',    description: 'Answer 200 questions correctly across all your games' },
]

function matchTopic(categoryUpper) {
  for (const rule of TOPIC_RULES) {
    for (const kw of rule.keywords) {
      if (categoryUpper.includes(kw)) return rule
    }
  }
  return null
}

async function run() {
  console.log('Starting migration...')

  // Step 1: Create app tables
  console.log('Creating app tables...')
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
      played_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id INTEGER NOT NULL REFERENCES users(id),
      achievement_id INTEGER NOT NULL REFERENCES achievements(id),
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, achievement_id)
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
    CREATE INDEX IF NOT EXISTS idx_games_played_user ON games_played(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_cgm_category ON category_group_mappings(cluebase_category);
    CREATE INDEX IF NOT EXISTS idx_cgm_group ON category_group_mappings(category_group_id);
  `)
  console.log('  Tables created.')

  // Step 2: Seed category_groups
  console.log('Seeding category_groups...')
  for (const rule of TOPIC_RULES) {
    await pool.query(
      'INSERT INTO category_groups (slug, display_name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
      [rule.topic, rule.display]
    )
  }
  console.log(`  Seeded ${TOPIC_RULES.length} topic groups.`)

  // Step 3: Build category_group_mappings from Cluebase's distinct categories
  console.log('Building category_group_mappings from Cluebase data...')
  const { rows: categories } = await pool.query(
    "SELECT DISTINCT category FROM clues WHERE category IS NOT NULL AND category != ''"
  )
  console.log(`  Found ${categories.length} distinct Cluebase categories. Mapping...`)

  const { rows: groups } = await pool.query('SELECT id, slug FROM category_groups')
  const groupBySlug = {}
  for (const g of groups) groupBySlug[g.slug] = g.id

  let mapped = 0
  for (const { category } of categories) {
    const upper = (' ' + category.toUpperCase() + ' ')
    const rule = matchTopic(upper)
    if (!rule) continue
    const groupId = groupBySlug[rule.topic]
    if (!groupId) continue
    await pool.query(
      'INSERT INTO category_group_mappings (category_group_id, cluebase_category) VALUES ($1, $2) ON CONFLICT (cluebase_category) DO NOTHING',
      [groupId, category]
    )
    mapped++
  }
  console.log(`  Mapped ${mapped} categories to topic groups.`)

  // Step 4: Import final_jeopardy.json
  console.log('Importing Final Jeopardy clues...')
  const fjPath = path.resolve(__dirname, '../data/jarchive/final_jeopardy.json')
  let fjData
  try {
    fjData = JSON.parse(readFileSync(fjPath, 'utf8'))
  } catch {
    console.log('  Warning: final_jeopardy.json not found — skipping FJ import.')
    fjData = []
  }

  let fjInserted = 0
  for (const entry of fjData) {
    if (!entry.clue_text || !entry.response_text || !entry.name) continue
    await pool.query(
      'INSERT INTO final_jeopardy (name, air_date, clue_text, response_text) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [entry.name, entry.air_date || null, entry.clue_text, entry.response_text]
    )
    fjInserted++
  }
  console.log(`  Imported ${fjInserted} Final Jeopardy clues.`)

  // Step 5: Seed achievements
  console.log('Seeding achievements...')
  let achInserted = 0
  for (const ach of ACHIEVEMENTS) {
    const result = await pool.query(
      'INSERT INTO achievements (slug, name, description) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [ach.slug, ach.name, ach.description]
    )
    if (result.rowCount > 0) achInserted++
  }
  console.log(`  Seeded ${achInserted} new achievements.`)

  await pool.end()
  console.log('\nMigration complete.')
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
