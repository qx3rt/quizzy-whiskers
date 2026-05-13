import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './db/database.js';
import { seedIfEmpty } from './db/seed.js';
import categoriesRouter from './routes/categories.js';
import boardRouter from './routes/board.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    await seedIfEmpty();
    console.log('Database ready');

    // Routes
    app.use('/api/categories', categoriesRouter);
    app.use('/api/board', boardRouter);

    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found'
      });
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
