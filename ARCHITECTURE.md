# ARCHITECTURE.md — ArvyaX Journal System

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React + Vite)                     │
│        JournalForm │ EntryCard │ InsightsPanel               │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP / REST
┌───────────────────────────▼─────────────────────────────────┐
│                  Express API (Node.js)                       │
│                                                             │
│  POST /api/journal             ← Create entry              │
│  GET  /api/journal/:userId     ← List entries              │
│  POST /api/journal/analyze     ← LLM analysis (cached)     │
│  GET  /api/journal/insights    ← Aggregated stats          │
│                                                             │
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │  Rate Limiter    │    │  LLM Service                │   │
│  │  (express-rate-  │    │  ┌───────────────────────┐  │   │
│  │   limit)         │    │  │ In-memory cache       │  │   │
│  │  General: 100/15m│    │  │ (node-cache, TTL 1hr) │  │   │
│  │  LLM:     20/15m │    │  └──────────┬────────────┘  │   │
│  └──────────────────┘    │             │ miss           │   │
│                          │  ┌──────────▼────────────┐  │   │
│                          │  │ Groq API              │  │   │
│                          │  │ (llama-3.1-8b-instant)│  │   │
│                          │  └───────────────────────┘  │   │
│                          └─────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  MongoDB Atlas                        │   │
│  │      journal_entries (with embedded analysis)        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

```
Developer
    │
    │  git push to main
    ▼
GitHub Repository
    │
    │  GitHub Actions triggers
    ▼
CI/CD Pipeline (.github/workflows/deploy.yml)
    │
    │  SSH into EC2
    ▼
AWS EC2 (t2.micro — Ubuntu 22.04)
    │
    │  docker compose up --build -d
    ▼
┌─────────────────────────────────────┐
│         Docker Compose              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  arvyax-frontend            │    │
│  │  nginx:alpine               │    │
│  │  Port: 80                   │    │
│  └──────────────┬──────────────┘    │
│                 │ proxy /api        │
│  ┌──────────────▼──────────────┐    │
│  │  arvyax-backend             │    │
│  │  node:20-alpine             │    │
│  │  Port: 3001                 │    │
│  └──────────────┬──────────────┘    │
└─────────────────┼───────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
  MongoDB Atlas         Groq API
  (cloud DB)            (LLM)
```

---

## Data Model

### `JournalEntry` (MongoDB Collection)

```json
{
  "_id": "ObjectId",
  "userId": "string (indexed)",
  "ambience": "forest | ocean | mountain | desert | meadow",
  "text": "string",
  "analysis": {
    "emotion": "string",
    "keywords": ["string"],
    "summary": "string",
    "analyzedAt": "Date"
  },
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**Design choices:**
- Analysis is embedded inside the entry document — a single read returns the entry and its analysis together with no joins needed
- MongoDB Atlas handles indexing, replication, and backups automatically
- Mongoose schema enforces enum validation on the ambience field
- Index on `userId + createdAt` for fast paginated user-scoped queries
- No separate cache collection needed — analysis lives directly with the entry

---

## CI/CD Pipeline

```
git push to main
      │
      ▼
GitHub Actions triggers
      │
      ▼
appleboy/ssh-action → SSH into EC2 (13.61.196.96)
      │
      ▼
cd ~/arvyax-journal
git pull origin main
docker compose down
docker compose up --build -d
docker image prune -f
      │
      ▼
Live at http://13.61.196.96
```

**GitHub Secrets used:**
| Secret | Description |
|--------|-------------|
| `EC2_HOST` | EC2 public IP address |
| `EC2_USERNAME` | ubuntu |
| `EC2_PRIVATE_KEY` | contents of .pem key file |

---

## 1. How Would You Scale This to 100,000 Users?

### Database
- **Upgrade MongoDB Atlas** from M0 free tier to M10+ which supports dedicated RAM, auto-scaling, and higher IOPS
- **Shard the collection** by `userId` hash — distributes data and query load across multiple nodes evenly as user count grows
- **Read replicas** for insights and analytics queries — offloads the primary node which handles all writes
- **Atlas Data Lake** for long-term archival of old entries without paying for hot storage

### Backend
- **Horizontally scale** Node.js behind a load balancer (AWS ALB or NGINX) — the stateless Express app makes this trivial, no shared session state
- **Async LLM processing** using BullMQ + Redis job queue:
  ```
  User saves entry  →  202 Accepted (instant response)
  BullMQ worker     →  calls Groq API
  Result saved      →  WebSocket / SSE pushes to client
  ```
  This removes the LLM wait time from the request/response cycle entirely
- **Connection pooling** — Mongoose handles this natively, configure `maxPoolSize` based on Atlas tier limits

### Frontend
- Serve the React build from a **CDN** (CloudFront, Fastly, Vercel)
- **Virtual scrolling** for users with hundreds of journal entries
- **Optimistic UI** — show entry immediately on save, update with analysis result when async job completes

### Infrastructure at 100k users
```
Users
  │
  ▼
CDN (CloudFront)             ← serves React SPA static files
  │
  ▼
Load Balancer (ALB)
  │
  ├── Node.js pod 1
  ├── Node.js pod 2           ← auto-scaled via K8s / ECS
  └── Node.js pod N
        │
        ├── MongoDB Atlas M30 (sharded by userId)
        ├── Redis (ElastiCache) — cache + job queue
        └── BullMQ workers → Groq API
```

---

## 2. How Would You Reduce LLM Cost?

### Caching (already implemented — zero cost on cache hit)
- **Layer 1 — In-memory:** node-cache with 1hr TTL. Text hashed with djb2 — identical text returns instantly with zero API cost
- **Layer 2 — MongoDB persistence:** Analysis stored inside the entry document. Re-opening an old entry never triggers a new API call

### Tiered model routing
```javascript
const model = text.split(" ").length < 50
  ? "llama-3.1-8b-instant"     // cheap and fast for short entries
  : "llama-3.3-70b-versatile"  // more accurate for long entries
```
The majority of journal entries are short — routing them to the smaller model cuts cost significantly.

### Prompt optimization
- Current prompt is already minimal — system message + one user turn
- Strip repeated whitespace and filler words before sending
- A 30% shorter prompt = 30% lower input token cost
- Cap `max_tokens` at 300 (already done) — actual response is always under 150 tokens

### Batch processing
- For background jobs (analyzing all unanalyzed entries overnight), collect multiple entries and send in a single prompt returning a JSON array
- Reduces API round trips and overhead cost per entry

### Groq free tier
```
llama-3.1-8b-instant:
  14,400 requests/day free
  30 requests/minute free
```
For early stage this is sufficient with zero cost.

### Semantic deduplication
- Embed user entries using a cheap embedding model
- Skip LLM analysis if cosine similarity to a recently analyzed entry exceeds 0.95
- Handles paraphrased entries that would otherwise miss a key-based cache

---

## 3. How Would You Cache Repeated Analysis?

### Current implementation (two layers)

```
Incoming request → hash(text) → node-cache (TTL 1hr)
                                        │ miss
                                        ▼
                              MongoDB analysis field
                                        │ miss
                                        ▼
                                   Groq API
                                        │
                              store in both cache layers
```

### At scale — Redis cache

```javascript
// Store result
await redis.set(`analysis:${hash}`, JSON.stringify(result), 'EX', 86400);

// Retrieve result
const cached = await redis.get(`analysis:${hash}`);
```

- Survives server restarts
- Shared across all API pods
- O(1) lookup, sub-millisecond response
- 24hr TTL — analysis results never change for fixed text

### Semantic cache (advanced)
- Generate embeddings for each analyzed text
- Query MongoDB Atlas Vector Search for nearest neighbor
- If similarity > 0.92 — return cached result, skip LLM call entirely
- Handles paraphrased entries that miss key-based cache

### Cache invalidation strategy
- Analysis results are deterministic for fixed text — no invalidation needed
- If LLM prompt changes (model upgrade), bump a `cache_version` key
- Treat all old cache entries as misses on version mismatch

---

## 4. How Would You Protect Sensitive Journal Data?

Journal entries are deeply personal. A production system must protect them at every layer.

### Encryption at Rest
- **MongoDB Atlas** encrypts all data at rest by default using AES-256
- **Field-level encryption** using MongoDB CSFLE — encrypt the `text` field client-side before it reaches the DB so even DB admins cannot read journal entries
- Store encryption keys in **AWS KMS** or **HashiCorp Vault** — never in code or environment files

### Encryption in Transit
- Enforce **TLS 1.2+** on all connections — API, MongoDB Atlas, Redis
- **Reject plain HTTP** — redirect all traffic to HTTPS
- Use **mutual TLS (mTLS)** for internal service-to-service communication

### Authentication & Authorization
- Replace simple `userId` string with **JWT authentication**
  - Short-lived access tokens (15 min) + refresh token rotation
  - Every endpoint validates token and asserts `token.sub === requested userId`
- Users can never access each other's entries — enforced at the MongoDB query level, not just routing

### API Security
- Rate limiting already implemented — prevents brute force and enumeration
- All inputs validated and sanitized — prevents injection attacks
- CORS restricted to known frontend origin in production
- 50KB payload size limit already implemented
- Add **Helmet.js** for security headers (X-Frame-Options, CSP, etc.)

### Data Privacy
- `DELETE /api/journal/:userId` — purge all user data on request (GDPR right to erasure)
- Never log raw journal text — only log entry IDs in application logs
- Anonymize data before running any analytics queries
- Groq API does not train on API inputs by default

### Infrastructure
- Run MongoDB in a **private subnet** — no direct public internet access
- Store all secrets in **environment variables** via GitHub Secrets and EC2 — never hardcoded
- Enable **automated backups** via MongoDB Atlas with point-in-time recovery
- **Dependency scanning** in CI using Dependabot or Snyk
- **Container image scanning** before deployment to catch vulnerabilities
- **Audit log** — record every data access event in an append-only collection
