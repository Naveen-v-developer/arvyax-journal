const NodeCache = require("node-cache");

// In-memory cache: TTL 1 hour, check every 10 minutes
const analysisCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

/**
 * Analyze the emotional content of a journal entry using the Anthropic API.
 * Results are cached by a hash of the text to avoid redundant LLM calls.
 *
 * @param {string} text - The raw journal entry text
 * @returns {{ emotion: string, keywords: string[], summary: string }}
 */
async function analyzeEmotion(text) {
  const cacheKey = hashText(text);

  // 1. Return cached result if available
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // 2. Call the Anthropic API
  const systemPrompt = `You are an expert emotion analyst specializing in nature therapy and mental wellness. 
Analyze journal entries and return ONLY valid JSON with no extra text, markdown, or code fences.

Response schema:
{
  "emotion": "<single dominant emotion word, lowercase>",
  "keywords": ["<3-6 meaningful keywords from the text>"],
  "summary": "<one concise sentence summarizing the user's mental state>"
}

Rules:
- emotion must be a single lowercase word (e.g. calm, anxious, joyful, melancholic, energized, peaceful)
- keywords must capture meaningful themes (nature elements, actions, feelings)
- summary must be empathetic, person-centered, and reference the nature context if present
- Return ONLY the JSON object. No preamble.`;

  const userPrompt = `Analyze this journal entry:\n\n"${text}"`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const rawText = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip possible markdown fences just in case
  const cleaned = rawText.replace(/```json|```/gi, "").trim();
  const result = JSON.parse(cleaned);

  // Validate shape
  if (!result.emotion || !Array.isArray(result.keywords) || !result.summary) {
    throw new Error("LLM returned unexpected shape: " + cleaned);
  }

  const normalized = {
    emotion: result.emotion.toLowerCase(),
    keywords: result.keywords.slice(0, 6),
    summary: result.summary,
  };

  // 3. Cache the result
  analysisCache.set(cacheKey, normalized);

  return { ...normalized, fromCache: false };
}

/** Simple djb2-style hash for cache keying */
function hashText(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

module.exports = { analyzeEmotion };
