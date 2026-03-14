# 🌿 ArvyaX — AI-Assisted Nature Journal

An AI-powered journaling system for ArvyaX immersive nature sessions. Users write about their forest, ocean, or mountain experiences; the system stores entries, analyzes emotions via LLM, and surfaces mental wellness insights over time.

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Backend  | Node.js + Express                 |
| Frontend | React + Vite                      |
| Database | MongoDB Atlas                     |
| LLM      | Groq API (llama-3.1-8b-instant)   |
| Cache    | In-process node-cache             |
| Docker   | Multi-stage builds + Compose      |

---

## Project Structure
```
arvyax-journal/
├── backend/
│   ├── middleware/
│   │   └── rateLimiter.js        # General + LLM rate limiting
│   ├── models/
│   │   └── db.js                 # MongoDB connection + Mongoose schema
│   ├── routes/
│   │   └── journal.js            # All API route handlers
│   ├── services/
│   │   └── llmService.js         # Groq API + in-memory cache
│   ├── server.js                 # Express app entry point
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── journal.js        # API client
│   │   ├── components/
│   │   │   ├── JournalForm.jsx
│   │   │   ├── EntryCard.jsx
│   │   │   └── InsightsPanel.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── nginx.conf
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
└── ARCHITECTURE.md
```

---

## Quick Start (Local)

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free)
- A [MongoDB Atlas](https://cloud.mongodb.com) cluster (free)

### 1. Clone & configure
```bash
git clone https://github.com/YOUR_USERNAME/arvyax-journal.git
cd arvyax-journal
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env and set GROQ_API_KEY and MONGODB_URI
npm install
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Docker (Recommended)
```bash
# Copy and fill in your keys
cp .env.example .env

# Build and run everything
docker compose up --build
```

- Frontend → [http://localhost](http://localhost)
- Backend  → [http://localhost:3001](http://localhost:3001)

---

## Environment Variables

| Variable       | Required | Description                          |
|----------------|----------|--------------------------------------|
| `GROQ_API_KEY` | ✅ Yes   | Groq API key from console.groq.com   |
| `MONGODB_URI`  | ✅ Yes   | MongoDB Atlas connection string      |
| `PORT`         | No       | Backend port (default: 3001)         |
| `NODE_ENV`     | No       | development or production            |
| `FRONTEND_URL` | No       | CORS origin in production            |

---

## API Reference

### `POST /api/journal`
Create a new journal entry.
```json
// Request
{
  "userId": "rahul",
  "ambience": "forest",
  "text": "I felt calm today walking through the forest trail"
}

// Response 201
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "userId": "rahul",
  "ambience": "forest",
  "text": "I felt calm today walking through the forest trail",
  "createdAt": "2026-03-14T10:00:00.000Z"
}
```

### `GET /api/journal/:userId`
Fetch all entries for a user.
```json
// Response
{
  "entries": [
    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "userId": "rahul",
      "ambience": "forest",
      "text": "I felt calm today...",
      "createdAt": "2026-03-14T10:00:00.000Z",
      "emotion": "calm",
      "keywords": ["forest", "calm", "nature"],
      "summary": "User felt peaceful during their forest session."
    }
  ],
  "total": 1
}
```

### `POST /api/journal/analyze`
Analyze text using Groq LLM.
```json
// Request
{
  "text": "I felt calm today walking through the forest trail",
  "entryId": "64f1a2b3c4d5e6f7a8b9c0d1"
}

// Response
{
  "emotion": "calm",
  "keywords": ["forest", "trail", "calm", "nature"],
  "summary": "User experienced peace and tranquility during their forest walk.",
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
  "recentKeywords": ["focus", "nature", "rain", "peace"],
  "emotionBreakdown": [
    { "emotion": "calm", "count": 4 },
    { "emotion": "peaceful", "count": 2 }
  ],
  "ambienceBreakdown": [
    { "ambience": "forest", "count": 5 },
    { "ambience": "ocean", "count": 3 }
  ]
}
```

### `GET /health`
Health check.
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-03-14T10:00:00.000Z",
  "llmConfigured": true
}
```

---

## Bonus Features Implemented

- ✅ LLM response caching — in-memory node-cache (TTL 1 hour) + MongoDB persistence
- ✅ Rate limiting — general (100 req/15 min) + LLM endpoint (20 req/15 min)
- ✅ Docker setup — multi-stage builds, health checks
- ✅ Input validation — all endpoints validate and return clear errors
- ✅ Cache indicators — UI shows ⚡ when result served from cache