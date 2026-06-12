# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (root)
```bash
npm run dev        # Vite dev server (default port 5173)
npm run build      # Production build → dist/
npm run lint       # ESLint
npm run preview    # Serve the dist/ build locally
```

### Backend
```bash
cd backend
npm run dev        # node --watch (auto-restart on changes)
npm start          # Production start
npm run seed       # Run scripts/seedDatabase.js (legacy; startup auto-seeds via syncCategories)
```

### Data pipeline (run from repo root)
```bash
node scripts/importJeopardy.mjs        # Parse raw jarchive HTML → backend/data/jarchive/*.json
node scripts/fetchArchive.mjs          # Fetch J-Archive episode links
node scripts/parseStudyPage.mjs        # Parse a study-page HTML file
node scripts/bulkIngest.mjs            # Batch ingest multiple pages
node scripts/cleanClueData.mjs         # Clean/normalize clue data
```

## Environment

Backend requires `backend/.env` (copy from `backend/.env.example`):
```
PORT=3001
NODE_ENV=development
JWT_SECRET=<required — server refuses to start without it>
```

Frontend uses `VITE_API_URL` (defaults to `http://localhost:3001` if unset).

## Architecture

This is a **Jeopardy! study app** with a React frontend and a Node/Express backend. Both are ESM (`"type": "module"`).

### Frontend (`src/`)
Single-page app with **all state and game logic inside `src/App.jsx`** — there is no router and no state management library. The entire game flow (lobby → category selection → round 1 → round 2 → Final Jeopardy → results) is driven by a `screen` state variable and `useState`/`useRef` hooks in one file.

Answer evaluation lives in `App.jsx`: answers are normalized (articles stripped, Jeopardy preamble removed), then fuzzy-matched via Levenshtein distance with an 80% similarity threshold (`FUZZY_MATCH_THRESHOLD`).

`src/utils/api.js` is the only HTTP layer — all backend calls go through it. It reads `VITE_API_URL` at build time.

### Backend (`backend/src/`)

**Database**: sql.js (SQLite compiled to WASM, running in Node). The DB is loaded from `backend/data/app.db` on startup, held entirely in memory, and written back to disk via `saveDatabase()` after every mutation. There is no migration system — the schema is `CREATE TABLE IF NOT EXISTS` applied on every startup in `db/database.js`.

**Startup sequence** (`server.js`): `initializeDatabase()` → `syncCategories()` (seeds jarchive JSON into DB if empty) → `seedAchievements()` → attach routes → listen.

**Routes**:
- `GET /api/board` — generates a 6-column board from the DB; optional `?topics=slug1,slug2` and `?round=Jeopardy!` filters. Board generation is in `src/utils/boardGenerator.js` using a Fisher-Yates shuffle (sql.js has no `ORDER BY RANDOM()`).
- `GET /api/board/final` — returns one random Final Jeopardy! clue.
- `GET /api/categories` — returns available topic areas with counts.
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` — JWT auth (30-day tokens).
- `POST /api/games`, `GET /api/games` — save/retrieve game history; `POST` also evaluates and awards achievements.
- `GET /api/achievements/mine` — achievements for the authenticated user.

**Auth**: `src/middleware/auth.js` exports `requireAuth` (Express middleware) and `signToken`. JWT_SECRET is required at import time — missing it throws immediately.

**Achievement logic** lives in `src/models/achievements.js` (`checkAndAwardAchievements`), called from the games route after saving a game.

### Data pipeline (`scripts/` at repo root)
Raw HTML from J-Archive is fetched/parsed into JSON files landing in `backend/data/jarchive/`. Each topic file is an array of `{name, topic_area, season, air_date, round, clues[]}` objects. `final_jeopardy.json` is flat clue objects. These JSON files are the source of truth for seeding; the DB is considered a cache of them.

### Deployment
Backend is configured for Railway (`backend/railway.toml`). Frontend builds to `dist/` and can be deployed statically; point `VITE_API_URL` at the Railway backend URL at build time.
