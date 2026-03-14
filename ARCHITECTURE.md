# ARCHITECTURE.md — ArvyaX Journal System

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
│   JournalForm │ EntryCard │ InsightsPanel                   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP / REST
┌────────────────────────▼────────────────────────────────────┐
│                  Express API (Node.js)                       │
│                                                             │
│  POST /api/journal          ← Create entry                  │
│  GET  /api/journal/:userId  ← List entries                  │
│  POST /api/journal/analyze  ← LLM analysis (cached)        │
│  GET  /api/journal/insights ← Aggregated stats              │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │  Rate Limiter    │    │  LLM Service                 │   │
│  │  (express-rate-  │    │  ┌────────────────────────┐  │   │
│  │   limit)         │    │  │ In-memory cache        │  │   │
│  │  General: 100/15m│    │  │ (node-cache, TTL 1hr)  │  │   │
│  │  LLM:     20/15m │    │  └────────┬───────────────┘  │   │
│  └──────────────────┘    │           │ miss              │   │
│                          │  ┌────────▼───────────────┐  │   │
│                          │  │ Anthropic Claude API   │  │   │
│                          │  │ (claude-sonnet-4)      │  │   │
│                          │  └────────────────────────┘  │   │
│                          └──────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   SQLite (WAL mode)                   │   │
│  │   journal_entries   │   analysis_cache               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Model

### `journal_entries`
| Column      | Type | Notes                                        |
|-------------|------|----------------------------------------------|
| id          | TEXT | UUID v4 primary key                          |
| user_id     | TEXT | Indexed for fast user-scoped queries         |
| ambience    | TEXT | ENUM: forest, ocean, mountain, desert, meadow|
| text        | TEXT | Raw journal entry                            |
| created_at  | TEXT | ISO-8601 timestamp                           |

### `analysis_cache`
| Column      | Type | Notes                                        |
|-------------|------|----------------------------------------------|
| id          | TEXT | UUID v4 primary key                          |
| entry_id    | TEXT | FK → journal_entries(id), CASCADE DELETE     |
| emotion     | TEXT | Dominant emotion (lowercase)                 |
| keywords    | TEXT | JSON-serialized string array                 |
| summary     | TEXT | One-sentence LLM summary                    |
| analyzed_at | TEXT | ISO-8601 timestamp                           |

**Design choices:**
- One-to-one relationship between entry and analysis (an entry's text never changes)
- Keywords stored as JSON string in SQLite (avoids a third join table for a read-heavy pattern)
- WAL mode enabled for concurrent reads during aggregation queries

---

## 1. How Would You Scale This to 100,000 Users?

### Database
- **Migrate from SQLite → PostgreSQL** as the first step. SQLite is single-writer; Postgres handles thousands of concurrent connections.
- Add **read replicas** for the insights/analytics queries (which are read-heavy) to offload the primary.
- **Partition** `journal_entries` by `user_id` hash or by date range to keep index sizes manageable.
- Move analysis results to a **dedicated Redis cluster** instead of a DB table, enabling sub-millisecond cache lookups.

### Backend
- **Horizontally scale** the Node.js API behind a load balancer (AWS ALB, NGINX) — the stateless Express app makes this trivial.
- Move LLM calls to a **background job queue** (BullMQ + Redis). The user posts an entry, gets a 202 Accepted response, and the analysis is processed asynchronously. A WebSocket or Server-Sent Event pushes the result back when ready.
- Use **connection pooling** (pg-pool, PgBouncer) to prevent DB connection exhaustion.

### LLM / Anthropic API
- Implement **request batching** — collect entries for 1–2 seconds and send them in a single prompt with multiple entries, parsing structured JSON back.
- Use **Anthropic's Batch API** for non-real-time analysis (50% cost discount, processes within 24 hours).

### Frontend
- Serve the React build from a **CDN** (CloudFront, Fastly).
- Implement **virtual scrolling** for users with hundreds of entries.

### Infrastructure
```
Users → CDN (React SPA)
     → ALB → Node.js pods (K8s / ECS, auto-scaled)
              → PostgreSQL primary (write)
              → PostgreSQL replicas (read/insights)
              → Redis (cache + job queue)
              → BullMQ workers → Anthropic API
```

---

## 2. How Would You Reduce LLM Cost?

### Caching (already implemented)
- **Layer 1 — In-memory:** `node-cache` with 1-hour TTL. Text hashed with djb2; identical text on any endpoint hit returns the cached result instantly (zero API cost).
- **Layer 2 — DB persistence:** Analysis stored in `analysis_cache`. Re-opening an old entry never triggers a new API call.

### Additional strategies
- **Anthropic Batch API:** For end-of-day or background jobs (e.g., analyzing all unanlayzed entries overnight), use the Batch API which costs 50% less than synchronous calls.
- **Tiered model routing:** Use `claude-haiku` for entries under 100 words; reserve `claude-sonnet` for longer, more nuanced entries. Haiku is ~15× cheaper.
- **Prompt compression:** Strip stop words and redundant phrases before sending to the API. A 30% shorter prompt → 30% lower input token cost.
- **Token budgeting:** Cap `max_tokens` at 300 (already done). The full emotion/keywords/summary response is consistently under 150 tokens.
- **Semantic deduplication:** Embed user entries (using a cheap embedding model) and skip LLM analysis if cosine similarity to a recently-analyzed entry exceeds 0.95.

---

## 3. How Would You Cache Repeated Analysis?

### Current implementation (two layers)

```
Incoming request → hash(text) → in-memory node-cache (TTL 1hr)
                                        │ miss
                                        ▼
                              SQLite analysis_cache (permanent)
                                        │ miss
                                        ▼
                              Anthropic Claude API
                                        │
                              store in both cache layers
```

### At scale

1. **Replace node-cache with Redis:**
   - `SET analysis:{hash} {json} EX 86400` — 24-hour TTL
   - Survives server restarts; shared across all API pods
   - O(1) lookup

2. **Semantic cache (advanced):**
   - Generate embeddings for each analyzed text.
   - Before calling the LLM, query a vector DB (Pinecone, pgvector) for nearest neighbor.
   - If similarity > 0.92, return cached result instead of making a new API call.
   - Handles paraphrased/slightly different entries that would otherwise miss a key-based cache.

3. **Cache invalidation:**
   - Analysis results are deterministic for fixed text → no invalidation needed.
   - If the LLM prompt/system message changes (model upgrade), bump a `cache_version` key and treat all old cache entries as misses.

---

## 4. How Would You Protect Sensitive Journal Data?

Journal entries are inherently personal and sensitive. A production system must treat them with care at every layer.

### Encryption at Rest
- **Database encryption:** Use PostgreSQL with `pgcrypto` or encrypt the `text` column with AES-256 before insert, storing the key in AWS KMS / HashiCorp Vault.
- **Disk encryption:** Enable full-disk encryption on all database volumes (AWS EBS with KMS, GCP Persistent Disk encryption).

### Encryption in Transit
- Enforce **TLS 1.2+** on all connections (API, DB, Redis). Reject HTTP.
- Use **mutual TLS (mTLS)** for internal service-to-service communication (API → DB, API → Redis).

### Authentication & Authorization
- Replace the simple `userId` query param with **JWT authentication** (short-lived access tokens, refresh token rotation).
- Every API endpoint must validate the token and assert `token.sub === requested_userId`. A user must never be able to read another user's entries — enforce this at the query level, not just routing.
- Use RBAC for admin/support access with full audit logging.

### API Security
- Rate limiting (already implemented) prevents brute-force enumeration.
- All inputs sanitized and validated (already implemented) to prevent injection.
- **CORS** restricted to the known frontend origin in production.
- **Payload size limit** (50 KB cap) prevents oversized request abuse.

### Data Governance
- **Minimal retention:** Provide users a `DELETE /api/journal/:userId` endpoint to purge all their data (GDPR right to erasure). Cascade deletes ensure analysis cache is also cleared.
- **Anonymization for analytics:** Strip PII before running aggregate/insight queries.
- **LLM data policy:** Anthropic does not train on API inputs by default. Confirm `data-processing` agreement. Do not log raw entry text in application logs — only log entry IDs.
- **Audit log:** Record every data access event (who accessed what, when) in an append-only audit table.

### Infrastructure
- Run the database in a **private subnet** with no public ingress.
- Use **secrets management** (AWS Secrets Manager, Vault) — never store API keys or DB credentials in environment files on servers.
- Regular **encrypted backups** with point-in-time recovery.
- **Vulnerability scanning** in CI (Dependabot, Snyk) and container image scanning before deployment.
