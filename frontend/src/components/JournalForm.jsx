import React, { useState } from "react";
import { createEntry } from "../api/journal";

const AMBIENCES = [
  { value: "forest",   label: "🌲 Forest",   color: "#8fbe5a" },
  { value: "ocean",    label: "🌊 Ocean",    color: "#5ab4be" },
  { value: "mountain", label: "⛰️ Mountain", color: "#9488d4" },
  { value: "desert",   label: "🏜️ Desert",  color: "#d4a45a" },
  { value: "meadow",   label: "🌿 Meadow",   color: "#7ad47a" },
];

export default function JournalForm({ userId, onCreated }) {
  const [ambience, setAmbience] = useState("forest");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim() || text.trim().length < 5) {
      setError("Please write at least a few words.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const entry = await createEntry(userId, ambience, text.trim());
      setText("");
      setSuccess(true);
      onCreated(entry);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 22, marginBottom: 16, color: "var(--text)" }}>
        New Entry
      </h2>

      {/* Ambience selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {AMBIENCES.map((a) => (
          <button
            key={a.value}
            onClick={() => setAmbience(a.value)}
            style={{
              padding: "6px 14px",
              borderRadius: 100,
              border: `1px solid ${ambience === a.value ? a.color : "var(--border)"}`,
              background: ambience === a.value ? `${a.color}22` : "transparent",
              color: ambience === a.value ? a.color : "var(--text2)",
              fontSize: 13,
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="How did your session feel today? Describe what you experienced..."
        rows={5}
        style={{
          width: "100%",
          padding: "12px 16px",
          fontSize: 15,
          lineHeight: 1.65,
          resize: "vertical",
          marginBottom: 12,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          {text.length} characters
        </span>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? <><span className="spinner" /> Saving…</> : "Save Entry"}
        </button>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {success && (
        <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 6 }}>
          ✓ Entry saved!
        </p>
      )}
    </div>
  );
}
