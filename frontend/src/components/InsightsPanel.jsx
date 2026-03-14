import React, { useState } from "react";
import { getInsights } from "../api/journal";

const AMBIENCE_ICONS = {
  forest: "🌲", ocean: "🌊", mountain: "⛰️", desert: "🏜️", meadow: "🌿",
};

export default function InsightsPanel({ userId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getInsights(userId);
      setInsights(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 22, color: "var(--text)" }}>
          Insights
        </h2>
        <button className="btn-ghost" onClick={load} disabled={loading} style={{ fontSize: 13 }}>
          {loading ? <><span className="spinner" />Loading…</> : "Refresh ↻"}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}

      {!insights && !loading && (
        <p style={{ color: "var(--text3)", fontSize: 14 }}>
          Click Refresh to load your mental wellness insights.
        </p>
      )}

      {insights && (
        <div className="fade-in">
          {/* Stat grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <StatBox label="Total Entries" value={insights.totalEntries} />
            <StatBox label="Analyzed" value={insights.analyzedEntries} />
            <StatBox
              label="Top Emotion"
              value={insights.topEmotion ? capitalize(insights.topEmotion) : "—"}
              accent
            />
            <StatBox
              label="Fav. Ambience"
              value={
                insights.mostUsedAmbience
                  ? `${AMBIENCE_ICONS[insights.mostUsedAmbience]} ${capitalize(insights.mostUsedAmbience)}`
                  : "—"
              }
            />
          </div>

          {/* Emotion breakdown */}
          {insights.emotionBreakdown.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Emotion Breakdown
              </p>
              {insights.emotionBreakdown.map((e) => (
                <BarRow
                  key={e.emotion}
                  label={e.emotion}
                  count={e.count}
                  max={insights.analyzedEntries || 1}
                />
              ))}
            </div>
          )}

          {/* Recent keywords */}
          {insights.recentKeywords.length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Recent Keywords
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {insights.recentKeywords.map((k) => (
                  <span key={k} className="tag">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "14px",
    }}>
      <p style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{
        fontSize: 20,
        fontFamily: "var(--font-display)",
        fontWeight: 400,
        color: accent ? "var(--accent)" : "var(--text)",
      }}>
        {value}
      </p>
    </div>
  );
}

function BarRow({ label, count, max }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
        <span style={{ color: "var(--text)", textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "var(--text3)" }}>{count}</span>
      </div>
      <div style={{ background: "var(--border)", borderRadius: 4, height: 4 }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent)",
          borderRadius: 4,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
