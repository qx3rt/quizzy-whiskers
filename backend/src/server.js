import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase, getDatabase, getAllQuery, saveDatabase } from './db/database.js';
import { syncCategories } from './db/seed.js';
import categoriesRouter from './routes/categories.js';
import boardRouter from './routes/board.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import achievementsRouter from './routes/achievements.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const ACHIEVEMENTS = [
  { slug: 'first_game',             name: 'First Steps',           description: 'Complete your first game' },
  { slug: 'perfect_round',          name: 'Clean Sweep',           description: 'Answer all 5 clues in a round correctly' },
  { slug: 'final_jeopardy_winner',  name: 'Final Say',             description: 'Win Final Jeopardy!' },
  { slug: 'high_roller',            name: 'High Roller',           description: 'Score $10,000 or more in a single game' },
  { slug: 'century_club',           name: 'Century Club',          description: 'Play 100 games' },
];

function seedAchievements() {
  const db = getDatabase();
  let added = 0;
  for (const ach of ACHIEVEMENTS) {
    const existing = getAllQuery('SELECT id FROM achievements WHERE slug = ?', [ach.slug]);
    if (existing.length === 0) {
      db.run('INSERT INTO achievements (slug, name, description) VALUES (?, ?, ?)', [ach.slug, ach.name, ach.description]);
      added++;
    }
  }
  if (added > 0) {
    saveDatabase();
    console.log(`Seeded ${added} achievements`);
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    await syncCategories();
    seedAchievements();
    console.log('Database ready');

    // Routes
    app.use('/api/categories', categoriesRouter);
    app.use('/api/board', boardRouter);
    app.use('/api/auth', authRouter);
    app.use('/api/games', gamesRouter);
    app.use('/api/achievements', achievementsRouter);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
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
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});

startServer();
