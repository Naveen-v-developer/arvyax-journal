const rateLimit = require("express-rate-limit");

/**
 * General API rate limiter – 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

/**
 * Stricter limiter for LLM endpoint – 20 requests per 15 minutes per IP
 * Prevents abuse and keeps API costs under control
 */
const llmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "LLM analysis rate limit reached. Please wait 15 minutes.",
  },
});

module.exports = { generalLimiter, llmLimiter };
