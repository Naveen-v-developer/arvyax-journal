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
| Deploy   | AWS EC2 (t2.micro free tier)      |
| CI/CD    | GitHub Actions                    |

---

## Live Demo

```
Frontend  →  http://13.61.196.96
Backend   →  http://13.61.196.96:3001/health
```

---

## Project Structure

```
arvyax-journal/
├── .github/
│   └── workflows/
│       └── deploy.yml            # CI/CD pipeline
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
git clone https://github.com/Naveen-v-developer/arvyax-journal.git
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

## Docker (Local)

```bash
# Copy and fill in your keys
cp .env.example .env

# Build and run everything
docker compose up --build
```

- Frontend → [http://localhost](http://localhost)
- Backend  → [http://localhost:3001](http://localhost:3001)

---

## AWS EC2 Deployment (Docker Compose)

### Prerequisites
- AWS Account (free tier)
- EC2 instance: `t2.micro` + `Ubuntu 22.04`
- Ports open in Security Group: `22`, `80`, `3001`

### Step 1 — Connect to EC2
```bash
# Fix key permissions (Windows)
icacls "C:\Users\yourname\Desktop\arvyax-key.pem" /inheritance:r /grant:r "%username%:R"

# SSH into EC2
ssh -i "C:\Users\yourname\Desktop\arvyax-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 2 — Install Docker on EC2
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Fix socket permission
sudo chmod 666 /var/run/docker.sock

# Verify
docker --version
docker compose version
```

### Step 3 — Clone repo and configure
```bash
git clone https://github.com/Naveen-v-developer/arvyax-journal.git
cd arvyax-journal

# Create .env file
nano .env
```

Paste inside:
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/arvyax?retryWrites=true&w=majority
```
Save: `Ctrl+X` → `Y` → `Enter`

### Step 4 — Deploy
```bash
docker compose up --build -d
```

### Step 5 — Verify
```bash
# Check containers
docker ps

# Test backend
curl http://localhost:3001/health
```

### Step 6 — Open in browser
```
Frontend  →  http://YOUR_EC2_PUBLIC_IP
Backend   →  http://YOUR_EC2_PUBLIC_IP:3001/health
```

### Useful commands
```bash
# View logs
docker compose logs -f

# Stop
docker compose down

# Restart
docker compose restart

# Update after code change
git pull
docker compose up --build -d
```

### AWS Free Tier Limits
```
Instance:      t2.micro — 750 hours/month free (12 months)
Storage:       30GB free
Data transfer: 100GB/month free
```

### Keep IP permanent (optional)
1. Go to AWS Console → EC2 → **Elastic IPs**
2. Click **Allocate Elastic IP**
3. Click **Associate** → select your instance
4. Your public IP will never change — free of charge

---

## CI/CD Pipeline (GitHub Actions)

Every push to `main` automatically deploys to AWS EC2.

### How it works
```
git push to main
      │
      ▼
GitHub Actions triggers
      │
      ▼
SSH into EC2
      │
      ▼
git pull + docker compose up --build -d
      │
      ▼
Live at http://13.61.196.96
```

### Pipeline file — `.github/workflows/deploy.yml`
```yaml
name: Deploy to AWS EC2

on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy via SSH
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USERNAME }}
          key: ${{ secrets.EC2_PRIVATE_KEY }}
          script: |
            cd ~/arvyax-journal
            git pull origin main
            docker compose down
            docker compose up --build -d
            docker image prune -f
            echo "Deployment successful"
```

### GitHub Secrets required

Go to repo → **Settings** → **Secrets and variables** → **Actions**

| Secret Name | Value |
|-------------|-------|
| `EC2_HOST` | `13.61.196.96` |
| `EC2_USERNAME` | `ubuntu` |
| `EC2_PRIVATE_KEY` | contents of `arvyax-key.pem` file |

### Trigger a deployment
```bash
git add .
git commit -m "your changes"
git push
```

Go to GitHub → **Actions** tab → watch live deployment logs

### Pipeline status
- Green tick = deployed successfully
- Red cross = deployment failed, click to see error logs

---

## Environment Variables

| Variable       | Required | Description                          |
|----------------|----------|--------------------------------------|
| `GROQ_API_KEY` | Yes      | Groq API key from console.groq.com   |
| `MONGODB_URI`  | Yes      | MongoDB Atlas connection string      |
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

- LLM response caching — in-memory node-cache (TTL 1 hour) + MongoDB persistence
- Rate limiting — general (100 req/15 min) + LLM endpoint (20 req/15 min)
- Docker setup — multi-stage builds, health checks
- Input validation — all endpoints validate and return clear errors
- Cache indicators — UI shows cached result indicator
- AWS EC2 deployment — Docker Compose on t2.micro free tier
- Auto-restart — containers restart automatically on server reboot
- CI/CD pipeline — GitHub Actions auto deploys on every push to main
