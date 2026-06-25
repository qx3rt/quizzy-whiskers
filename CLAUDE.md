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
```

### Data pipeline (run from repo root)
```bash
node scripts/importJeopardy.mjs        # Parse raw jarchive HTML → backend/data/jarchive/*.json
node scripts/fetchArchive.mjs          # Fetch J-Archive episode links
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
Single-page app with **state and game logic coordinated by `src/App.jsx`** — there is no router and no state management library. The entire game flow (lobby → category selection → round 1 → round 2 → Final Jeopardy → results) is driven by a `gamePhase` state variable in App.jsx; screen-specific UI is in `src/components/`.

Answer evaluation lives in `src/utils/answerEval.js`: answers are normalized (articles stripped, Jeopardy preamble removed), then fuzzy-matched via Levenshtein distance with an 80% similarity threshold (`FUZZY_MATCH_THRESHOLD`).

`src/utils/api.js` is the only HTTP layer — all backend calls go through it. It reads `VITE_API_URL` at build time.

### Backend (`backend/src/`)

**Database**: PostgreSQL (hosted on Railway). Schema is applied via `CREATE TABLE IF NOT EXISTS` on every startup in `db/database.js` — no separate migration step needed for new deployments. The Cluebase dataset is the primary clue source.

**Startup sequence** (`server.js`): `initializeDatabase()` → `syncCategories()` (seeds category groups from Cluebase if empty) → `seedAchievements()` → attach routes → listen.

**Routes**:
- `GET /api/board` — generates a 6-column board from the DB; optional `?topics=slug1,slug2` and `?round=Jeopardy!` filters. Board generation is in `src/utils/boardGenerator.js` using a Fisher-Yates shuffle.
- `GET /api/board/final` — returns one random Final Jeopardy! clue.
- `GET /api/categories` — returns available topic areas with counts.
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` — JWT auth (30-day tokens).
- `POST /api/games`, `GET /api/games` — save/retrieve game history; `POST` also evaluates and awards achievements.
- `GET /api/achievements/mine` — achievements for the authenticated user.

**Auth**: `src/middleware/auth.js` exports `requireAuth` (Express middleware) and `signToken`. JWT_SECRET is required at import time — missing it throws immediately.

**Achievement logic** lives in `src/models/achievements.js` (`checkAndAwardAchievements`), called from the games route after saving a game.

### Data pipeline (`scripts/` at repo root)
Raw HTML from J-Archive is fetched/parsed into JSON files landing in `backend/data/jarchive/`. Each topic file is an array of `{name, topic_area, season, air_date, round, clues[]}` objects. `final_jeopardy.json` is flat clue objects. These JSON files are the source of truth for Final Jeopardy seeding; Cluebase is used for regular clues.

### Deployment
Backend is configured for Railway (`backend/railway.toml`). Frontend builds to `dist/` and can be deployed statically; point `VITE_API_URL` at the Railway backend URL at build time.
