const NodeCache = require("node-cache");
const analysisCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

async function analyzeEmotion(text) {
  const cacheKey = hashText(text);
  const cached = analysisCache.get(cacheKey);
  if (cached) return { ...cached, fromCache: true };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are an emotion analyst for a nature wellness journal.
Return ONLY valid JSON, no markdown, no extra text, no explanation.
Schema: { "emotion": "single lowercase word", "keywords": ["3-6 keywords"], "summary": "one sentence" }`,
        },
        {
          role: "user",
          content: `Analyze this journal entry:\n\n"${text}"`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content
    .replace(/```json|```/gi, "")
    .trim();

  const result = JSON.parse(raw);

  if (!result.emotion || !Array.isArray(result.keywords) || !result.summary) {
    throw new Error("Unexpected response shape: " + raw);
  }

  const normalized = {
    emotion: result.emotion.toLowerCase(),
    keywords: result.keywords.slice(0, 6),
    summary: result.summary,
  };

  analysisCache.set(cacheKey, normalized);
  return { ...normalized, fromCache: false };
}

function hashText(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

module.exports = { analyzeEmotion };