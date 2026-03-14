require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./models/db");
const { generalLimiter, llmLimiter } = require("./middleware/rateLimiter");
const journalRoutes = require("./routes/journal");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "50kb" }));
app.use(generalLimiter);

app.post("/api/journal/analyze", llmLimiter);
app.use("/api/journal", journalRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    llmConfigured: !!process.env.GROQ_API_KEY,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, _next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ error: "Internal server error." });
});

// Connect DB first, then start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌿 ArvyaX Journal API running on http://localhost:${PORT}`);
    console.log(`   LLM: ${process.env.GROQ_API_KEY ? "✅ Groq Configured" : "❌ GROQ_API_KEY not set"}`);
    console.log(`   Env: ${process.env.NODE_ENV || "development"}\n`);
  });
});

module.exports = app;