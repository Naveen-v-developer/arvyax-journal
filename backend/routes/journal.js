const express = require("express");
const { JournalEntry } = require("../models/db");
const { analyzeEmotion } = require("../services/llmService");

const router = express.Router();

const VALID_AMBIENCES = ["forest", "ocean", "mountain", "desert", "meadow"];

// ─── POST /api/journal ────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { userId, ambience, text } = req.body;

  if (!userId || typeof userId !== "string" || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }
  if (!ambience || !VALID_AMBIENCES.includes(ambience)) {
    return res.status(400).json({
      error: `ambience is required. Valid values: ${VALID_AMBIENCES.join(", ")}.`,
    });
  }
  if (!text || typeof text !== "string" || text.trim().length < 5) {
    return res.status(400).json({ error: "text must be at least 5 characters." });
  }

  try {
    const entry = await JournalEntry.create({
      userId: userId.trim(),
      ambience,
      text: text.trim(),
    });

    return res.status(201).json({
      id: entry._id,
      userId: entry.userId,
      ambience: entry.ambience,
      text: entry.text,
      createdAt: entry.createdAt,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save entry." });
  }
});

// ─── POST /api/journal/analyze ────────────────────────────────────────────────
router.post("/analyze", async (req, res) => {
  const { text, entryId } = req.body;

  if (!text || typeof text !== "string" || text.trim().length < 5) {
    return res.status(400).json({ error: "text must be at least 5 characters." });
  }

  try {
    // Check DB cache first if entryId provided
    if (entryId) {
      const existing = await JournalEntry.findById(entryId);
      if (existing?.analysis?.emotion) {
        return res.json({
          emotion: existing.analysis.emotion,
          keywords: existing.analysis.keywords,
          summary: existing.analysis.summary,
          fromCache: true,
        });
      }
    }

    const result = await analyzeEmotion(text.trim());

    // Save analysis back to the entry
    if (entryId) {
      await JournalEntry.findByIdAndUpdate(entryId, {
        analysis: {
          emotion: result.emotion,
          keywords: result.keywords,
          summary: result.summary,
          analyzedAt: new Date(),
        },
      });
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
router.get("/insights/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  try {
    const uid = userId.trim();

    const totalEntries = await JournalEntry.countDocuments({ userId: uid });

    if (totalEntries === 0) {
      return res.json({
        totalEntries: 0,
        analyzedEntries: 0,
        topEmotion: null,
        mostUsedAmbience: null,
        recentKeywords: [],
        emotionBreakdown: [],
        ambienceBreakdown: [],
      });
    }

    // Analyzed entries count
    const analyzedEntries = await JournalEntry.countDocuments({
      userId: uid,
      "analysis.emotion": { $exists: true },
    });

    // Top emotion
    const emotionAgg = await JournalEntry.aggregate([
      { $match: { userId: uid, "analysis.emotion": { $exists: true } } },
      { $group: { _id: "$analysis.emotion", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Most used ambience
    const ambienceAgg = await JournalEntry.aggregate([
      { $match: { userId: uid } },
      { $group: { _id: "$ambience", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Recent keywords from last 10 analyzed entries
    const recentEntries = await JournalEntry.find({
      userId: uid,
      "analysis.keywords": { $exists: true },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("analysis.keywords");

    const recentKeywords = [
      ...new Set(recentEntries.flatMap((e) => e.analysis.keywords)),
    ].slice(0, 10);

    return res.json({
      totalEntries,
      analyzedEntries,
      topEmotion: emotionAgg[0]?._id ?? null,
      mostUsedAmbience: ambienceAgg[0]?._id ?? null,
      recentKeywords,
      emotionBreakdown: emotionAgg.map((e) => ({
        emotion: e._id,
        count: e.count,
      })),
      ambienceBreakdown: ambienceAgg.map((a) => ({
        ambience: a._id,
        count: a.count,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch insights." });
  }
});

// ─── GET /api/journal/:userId ─────────────────────────────────────────────────
// MUST be last — wildcard would swallow /analyze and /insights
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  if (!userId || !userId.trim()) {
    return res.status(400).json({ error: "userId is required." });
  }

  try {
    const entries = await JournalEntry.find({ userId: userId.trim() })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit));

    const formatted = entries.map((e) => ({
      id: e._id,
      userId: e.userId,
      ambience: e.ambience,
      text: e.text,
      createdAt: e.createdAt,
      emotion: e.analysis?.emotion ?? null,
      keywords: e.analysis?.keywords ?? null,
      summary: e.analysis?.summary ?? null,
      analyzedAt: e.analysis?.analyzedAt ?? null,
    }));

    return res.json({ entries: formatted, total: formatted.length });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch entries." });
  }
});

module.exports = router;