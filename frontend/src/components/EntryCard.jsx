import React, { useState } from "react";
import { analyzeText } from "../api/journal";

const AMBIENCE_ICONS = {
  forest: "🌲", ocean: "🌊", mountain: "⛰️", desert: "🏜️", meadow: "🌿",
};

export default function EntryCard({ entry, onAnalyzed }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(
    entry.emotion
      ? { emotion: entry.emotion, keywords: entry.keywords, summary: entry.summary, fromCache: true }
      : null
  );

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    try {
      const result = await analyzeText(entry.text, entry.id);
      setAnalysis(result);
      onAnalyzed(entry.id, result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const date = new Date(entry.createdAt);
  const dateStr = date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div
      className="card fade-in"
      style={{
        marginBottom: 14,
        borderLeft: `3px solid ${getAmbienceColor(entry.ambience)}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 13, color: getAmbienceColor(entry.ambience), fontWeight: 500 }}>
            {AMBIENCE_ICONS[entry.ambience]} {capitalize(entry.ambience)}
          </span>
          <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {dateStr} · {timeStr}
          </div>
        </div>
        {analysis && (
          <span className="emotion-tag">{analysis.emotion}</span>
        )}
      </div>

      {/* Entry text */}
      <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>
        {entry.text}
      </p>

      {/* Analysis result */}
      {analysis && (
        <div
          style={{
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 10,
          }}
        >
          <p style={{ fontSize: 13, color: "var(--text)", marginBottom: 8 }}>
            {analysis.summary}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {analysis.keywords.map((k) => (
              <span key={k} className="tag">{k}</span>
            ))}
          </div>
          {analysis.fromCache && (
            <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>
              ⚡ Cached result
            </p>
          )}
        </div>
      )}

      {/* Analyze button */}
      {!analysis && (
        <div>
          <button
            className="btn-ghost"
            onClick={handleAnalyze}
            disabled={loading}
            style={{ fontSize: 13 }}
          >
            {loading ? <><span className="spinner" />Analyzing…</> : "✦ Analyze Emotion"}
          </button>
          {error && <p className="error-msg">{error}</p>}
        </div>
      )}
    </div>
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getAmbienceColor(ambience) {
  return {
    forest: "#8fbe5a", ocean: "#5ab4be", mountain: "#9488d4",
    desert: "#d4a45a", meadow: "#7ad47a",
  }[ambience] || "#8fbe5a";
}
