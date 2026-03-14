const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getDb } = require("../models/db");
const { analyzeEmotion } = require("../services/llmService");

const router = express.Router();

const VALID_AMBIENCES = ["forest", "ocean", "mountain", "desert", "meadow"];

// ─── POST /api/journal ────────────────────────────────────────────────────────
// Create a new journal entry
router.post("/", (req, res) => {
  const { userId, ambience, text } = req.body;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required and must be a non-empty string." });
  }
  if (!ambience || !VALID_AMBIENCES.includes(ambience)) {
    return res.status(400).json({
      error: `ambience is required. Valid values: ${VALID_AMBIENCES.join(", ")}.`,
    });
  }
  if (!text || typeof text !== "string" || text.trim().length < 5) {
    return res.status(400).json({ error: "text must be at least 5 characters." });
  }

  const db = getDb();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO journal_entries (id, user_id, ambience, text, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId.trim(), ambience, text.trim(), createdAt);

  return res.status(201).json({
    id,
    userId: userId.trim(),
    ambience,
    text: text.trim(),
    createdAt,
  });
});

// ─── GET /api/journal/:userId ─────────────────────────────────────────────────
// Fetch all journal entries for a user, newest first
router.get("/:userId", (req, res) => {
  const { userId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  if (!userId || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  const db = getDb();

  const entries = db
    .prepare(
      `SELECT
         je.id,
         je.user_id   AS userId,
         je.ambience,
         je.text,
         je.created_at AS createdAt,
         ac.emotion,
         ac.keywords,
         ac.summary,
         ac.analyzed_at AS analyzedAt
       FROM journal_entries je
       LEFT JOIN analysis_cache ac ON ac.entry_id = je.id
       WHERE je.user_id = ?
       ORDER BY je.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(userId.trim(), Number(limit), Number(offset));

  const parsed = entries.map((e) => ({
    ...e,
    keywords: e.keywords ? JSON.parse(e.keywords) : null,
  }));

  return res.json({ entries: parsed, total: parsed.length });
});

// ─── POST /api/journal/analyze ────────────────────────────────────────────────
// Analyze a piece of text (or a stored entry) using the LLM
router.post("/analyze", async (req, res) => {
  const { text, entryId } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 5) {
    return res.status(400).json({ error: "text must be at least 5 characters." });
  }

  const db = getDb();

  // If entryId provided, check if we already have a cached DB result
  if (entryId) {
    const cached = db
      .prepare(`SELECT * FROM analysis_cache WHERE entry_id = ?`)
      .get(entryId);

    if (cached) {
      return res.json({
        emotion: cached.emotion,
        keywords: JSON.parse(cached.keywords),
        summary: cached.summary,
        fromCache: true,
      });
    }
  }

  try {
    const result = await analyzeEmotion(text.trim());

    // Persist to DB cache if we have an entryId
    if (entryId) {
      // Verify entry exists
      const entry = db
        .prepare(`SELECT id FROM journal_entries WHERE id = ?`)
        .get(entryId);

      if (entry) {
        db.prepare(
          `INSERT OR REPLACE INTO analysis_cache (id, entry_id, emotion, keywords, summary, analyzed_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          uuidv4(),
          entryId,
          result.emotion,
          JSON.stringify(result.keywords),
          result.summary,
          new Date().toISOString()
        );
      }
    }

    return res.json({
      emotion: result.emotion,
      keywords: result.keywords,
      summary: result.summary,
      fromCache: result.fromCache,
    });
  } catch (err) {
    console.error("[analyze] LLM error:", err.message);
    return res.status(502).json({
      error: "Failed to analyze text. Please check your API key and try again.",
      detail: err.message,
    });
  }
});

// ─── GET /api/journal/insights/:userId ───────────────────────────────────────
// Aggregate insights for a user's journal history
router.get("/insights/:userId", (req, res) => {
  const { userId } = req.params;

  if (!userId || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  const db = getDb();
  const uid = userId.trim();

  const totalRow = db
    .prepare(`SELECT COUNT(*) as total FROM journal_entries WHERE user_id = ?`)
    .get(uid);

  const totalEntries = totalRow.total;

  if (totalEntries === 0) {
    return res.json({
      totalEntries: 0,
      topEmotion: null,
      mostUsedAmbience: null,
      recentKeywords: [],
      analyzedEntries: 0,
      emotionBreakdown: [],
      ambienceBreakdown: [],
    });
  }

  // Top emotion from analyzed entries
  const topEmotionRow = db
    .prepare(
      `SELECT ac.emotion, COUNT(*) as cnt
       FROM analysis_cache ac
       JOIN journal_entries je ON je.id = ac.entry_id
       WHERE je.user_id = ?
       GROUP BY ac.emotion
       ORDER BY cnt DESC
       LIMIT 1`
    )
    .get(uid);

  // Most used ambience
  const topAmbienceRow = db
    .prepare(
      `SELECT ambience, COUNT(*) as cnt
       FROM journal_entries
       WHERE user_id = ?
       GROUP BY ambience
       ORDER BY cnt DESC
       LIMIT 1`
    )
    .get(uid);

  // Recent keywords (from last 10 analyzed entries)
  const recentAnalyses = db
    .prepare(
      `SELECT ac.keywords
       FROM analysis_cache ac
       JOIN journal_entries je ON je.id = ac.entry_id
       WHERE je.user_id = ?
       ORDER BY je.created_at DESC
       LIMIT 10`
    )
    .all(uid);

  const recentKeywords = [
    ...new Set(
      recentAnalyses.flatMap((r) => JSON.parse(r.keywords))
    ),
  ].slice(0, 10);

  // Emotion breakdown
  const emotionBreakdown = db
    .prepare(
      `SELECT ac.emotion, COUNT(*) as count
       FROM analysis_cache ac
       JOIN journal_entries je ON je.id = ac.entry_id
       WHERE je.user_id = ?
       GROUP BY ac.emotion
       ORDER BY count DESC`
    )
    .all(uid);

  // Ambience breakdown
  const ambienceBreakdown = db
    .prepare(
      `SELECT ambience, COUNT(*) as count
       FROM journal_entries
       WHERE user_id = ?
       GROUP BY ambience
       ORDER BY count DESC`
    )
    .all(uid);

  // Count analyzed entries
  const analyzedRow = db
    .prepare(
      `SELECT COUNT(*) as cnt
       FROM analysis_cache ac
       JOIN journal_entries je ON je.id = ac.entry_id
       WHERE je.user_id = ?`
    )
    .get(uid);

  return res.json({
    totalEntries,
    analyzedEntries: analyzedRow.cnt,
    topEmotion: topEmotionRow?.emotion ?? null,
    mostUsedAmbience: topAmbienceRow?.ambience ?? null,
    recentKeywords,
    emotionBreakdown,
    ambienceBreakdown,
  });
});

module.exports = router;
