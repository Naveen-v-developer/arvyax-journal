# 🌿 ArvyaX — AI-Assisted Nature Journal

An AI-powered journaling system for users of ArvyaX immersive nature sessions. Users write about their forest, ocean, or mountain experiences; the system stores entries, analyzes emotions via an LLM, and surfaces mental wellness insights over time.

---

## Tech Stack

| Layer    | Technology                      |
|----------|---------------------------------|
| Backend  | Node.js + Express               |
| Frontend | React + Vite                    |
| Database | SQLite (via `better-sqlite3`)   |
| LLM      | Anthropic Claude (Sonnet 4)     |
| Cache    | In-process `node-cache` + SQLite|
| Docker   | Multi-stage builds + Compose    |

---

## Quick Start

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone & configure

```bash
git clone <repo-url>
cd arvyax-journal
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
npm install
npm run dev        # starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # starts on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173), enter any user ID, and start journaling.

---

## Docker (Recommended)

```bash
# From project root
cp backend/.env.example .env
# Edit .env and add: ANTHROPIC_API_KEY=your_key_here

docker compose up --build
```

- Frontend → [http://localhost](http://localhost)
- Backend API → [http://localhost:3001](http://localhost:3001)

---

## API Reference

### `POST /api/journal`
Create a new journal entry.

```json
// Request
{ "userId": "alice", "ambience": "forest", "text": "I felt calm today..." }

// Response 201
{ "id": "uuid", "userId": "alice", "ambience": "forest", "text": "...", "createdAt": "..." }
```

### `GET /api/journal/:userId`
Fetch all entries for a user (includes analysis if previously run).

```json
// Response
{
  "entries": [
    {
      "id": "uuid",
      "userId": "alice",
      "ambience": "forest",
      "text": "...",
      "createdAt": "...",
      "emotion": "calm",
      "keywords": ["rain", "nature", "peace"],
      "summary": "User experienced relaxation during their forest session."
    }
  ],
  "total": 1
}
```

### `POST /api/journal/analyze`
Analyze text using the LLM. Optionally pass `entryId` to persist the result.

```json
// Request
{ "text": "I felt calm today after listening to the rain", "entryId": "optional-uuid" }

// Response
{
  "emotion": "calm",
  "keywords": ["rain", "nature", "peace"],
  "summary": "User experienced relaxation during the forest session.",
  "fromCache": false
}
```

### `GET /api/journal/insights/:userId`
Aggregated mental wellness insights.

```json
// Response
{
  "totalEntries": 8,
  "analyzedEntries": 6,
  "topEmotion": "calm",
  "mostUsedAmbience": "forest",
  "recentKeywords": ["focus", "nature", "rain"],
  "emotionBreakdown": [{ "emotion": "calm", "count": 4 }],
  "ambienceBreakdown": [{ "ambience": "forest", "count": 5 }]
}
```

### `GET /health`
Health check for deployment/orchestration.

---

## Project Structure

```
arvyax-journal/
├── backend/
│   ├── models/
│   │   └── db.js              # SQLite schema + connection
│   ├── routes/
│   │   └── journal.js         # All API route handlers
│   ├── services/
│   │   └── llmService.js      # Anthropic API + in-memory cache
│   ├── middleware/
│   │   └── rateLimiter.js     # General + LLM-specific rate limits
│   ├── server.js              # Express app entry point
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── journal.js     # Typed API client
│   │   ├── components/
│   │   │   ├── JournalForm.jsx
│   │   │   ├── EntryCard.jsx
│   │   │   └── InsightsPanel.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   └── vite.config.js
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md
```

---

## Bonus Features Implemented

- ✅ **LLM response caching** — two-layer: in-memory (`node-cache`) + SQLite persistence
- ✅ **Rate limiting** — general (100 req/15 min) + stricter LLM limit (20 req/15 min)
- ✅ **Docker setup** — multi-stage builds, health checks, data volume persistence
- ✅ **Cache indicators** — UI shows ⚡ when a result was served from cache
- ✅ **Input validation** — all endpoints validate and return clear error messages
- ✅ **WAL mode SQLite** — for better concurrent read performance

---

## Environment Variables

| Variable            | Required | Description                         |
|---------------------|----------|-------------------------------------|
| `ANTHROPIC_API_KEY` | ✅ Yes   | Your Anthropic API key              |
| `PORT`              | No       | Backend port (default: 3001)        |
| `NODE_ENV`          | No       | `development` or `production`       |
| `FRONTEND_URL`      | No       | CORS origin in production           |
