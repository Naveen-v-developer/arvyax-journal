require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { generalLimiter, llmLimiter } = require("./middleware/rateLimiter");
const journalRoutes = require("./routes/journal");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "50kb" })); // Prevent oversized payloads
app.use(generalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
// Apply stricter rate limit only to the LLM analyze endpoint
app.use("/api/journal/analyze", llmLimiter);
app.use("/api/journal", journalRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    llmConfigured: !!process.env.ANTHROPIC_API_KEY,
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ error: "Internal server error." });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 ArvyaX Journal API running on http://localhost:${PORT}`);
  console.log(`   LLM: ${process.env.ANTHROPIC_API_KEY ? "✅ Configured" : "❌ ANTHROPIC_API_KEY not set"}`);
  console.log(`   Env: ${process.env.NODE_ENV || "development"}\n`);
});

module.exports = app;
