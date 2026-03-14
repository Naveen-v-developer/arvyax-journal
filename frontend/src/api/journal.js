const BASE = "/api/journal";

export async function createEntry(userId, ambience, text) {
  const r = await fetch(`${BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ambience, text }),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error || "Failed to create entry");
  }
  return r.json();
}

export async function getEntries(userId) {
  const r = await fetch(`${BASE}/${encodeURIComponent(userId)}`);
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error || "Failed to fetch entries");
  }
  return r.json(); // { entries, total }
}

export async function analyzeText(text, entryId) {
  const body = { text };
  if (entryId) body.entryId = entryId;
  const r = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error || "Failed to analyze");
  }
  return r.json(); // { emotion, keywords, summary, fromCache }
}

export async function getInsights(userId) {
  const r = await fetch(`${BASE}/insights/${encodeURIComponent(userId)}`);
  if (!r.ok) {
    const e = await r.json();
    throw new Error(e.error || "Failed to fetch insights");
  }
  return r.json();
}
