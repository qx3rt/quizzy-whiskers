import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase, runQuery, getAllQuery } from './db/database.js';
import categoriesRouter from './routes/categories.js';
import { syncCategoryGroups } from './models/categories.js';
import { seedClues, seedFinalJeopardy, fixClueEscapes } from './models/clueSeeder.js';
import boardRouter from './routes/board.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import achievementsRouter from './routes/achievements.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ACHIEVEMENTS = [
  { slug: 'first_game',             name: 'First Steps',           description: 'Complete your first game' },
  { slug: 'ten_games',              name: 'Getting Warmed Up',     description: 'Play 10 games' },
  { slug: 'fifty_games',            name: 'Seasoned Contestant',   description: 'Play 50 games' },
  { slug: 'century_club',           name: 'Century Club',          description: 'Play 100 games' },
  { slug: 'perfect_round',          name: 'Clean Sweep',           description: 'Answer all 5 clues in a round correctly with no misses or timeouts' },
  { slug: 'perfect_game',           name: 'Flawless Victory',      description: 'Complete both rounds with no incorrect answers or timeouts' },
  { slug: 'no_timeouts',            name: 'Quick Draw',            description: 'Finish a full game without any timeouts' },
  { slug: 'double_dominator',       name: 'Double Down',           description: 'Answer all Double Jeopardy clues correctly' },
  { slug: 'final_jeopardy_winner',  name: 'Final Say',             description: 'Win Final Jeopardy!' },
  { slug: 'fj_regular',             name: 'Final Authority',       description: 'Win Final Jeopardy! 5 times' },
  { slug: 'high_roller',            name: 'High Roller',           description: 'Score $10,000 or more in a single game' },
  { slug: 'grand_champion',         name: 'Grand Champion',        description: 'Score $20,000 or more in a single game' },
  { slug: 'answer_machine',         name: 'Answer Machine',        description: 'Answer 200 questions correctly across all your games' },
];

async function seedAchievements() {
  let added = 0;
  for (const ach of ACHIEVEMENTS) {
    const result = await runQuery(
      'INSERT INTO achievements (slug, name, description) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
      [ach.slug, ach.name, ach.description]
    );
    if (result.rowCount > 0) added++;
  }
  if (added > 0) console.log(`Seeded ${added} achievements`);
}

// Middleware
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : true; // allow all when not configured; set CORS_ORIGIN in production to restrict
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    await seedClues();
    await fixClueEscapes();
    await seedFinalJeopardy();
    await syncCategoryGroups();
    await seedAchievements();
    console.log('Database ready');

    // Routes
    app.use('/api/categories', categoriesRouter);
    app.use('/api/board', boardRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/games', gamesRouter);
    app.use('/api/achievements', achievementsRouter);

    // Health check — includes category counts for diagnostics
    app.get('/api/health', async (req, res) => {
      try {
        const [g] = await getAllQuery('SELECT COUNT(*)::int AS groups FROM category_groups');
        const [m] = await getAllQuery('SELECT COUNT(*)::int AS mappings FROM category_group_mappings');
        res.json({ status: 'ok', categoryGroups: g.groups, categoryMappings: m.mappings });
      } catch {
        res.json({ status: 'ok' });
      }
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ success: false, error: 'Not found' });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Quizzy Whiskers backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  closeDatabase()
    .then(() => process.exit(0))
    .catch((err) => { console.error('Shutdown error:', err); process.exit(1); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
