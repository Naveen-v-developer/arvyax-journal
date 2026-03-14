import React, { useState, useEffect, useCallback } from "react";
import JournalForm from "./components/JournalForm";
import EntryCard from "./components/EntryCard";
import InsightsPanel from "./components/InsightsPanel";
import { getEntries } from "./api/journal";

export default function App() {
  const [userId, setUserId] = useState(() => localStorage.getItem("arvyax_uid") || "");
  const [draftId, setDraftId] = useState(userId);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [activeTab, setActiveTab] = useState("journal"); // journal | insights

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoadingEntries(true);
    try {
      const { entries } = await getEntries(userId);
      setEntries(entries);
    } catch (_) {}
    setLoadingEntries(false);
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleLogin(e) {
    e.preventDefault();
    const id = draftId.trim();
    if (!id) return;
    localStorage.setItem("arvyax_uid", id);
    setUserId(id);
  }

  function handleCreated(entry) {
    setEntries((prev) => [entry, ...prev]);
  }

  function handleAnalyzed(entryId, analysis) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, ...analysis } : e
      )
    );
  }

  // ─── Login screen ──────────────────────────────────────────────────────────
  if (!userId) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}>
        <div className="card" style={{ maxWidth: 400, width: "100%", textAlign: "center", padding: "40px 32px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontWeight: 300,
            fontSize: 28,
            marginBottom: 6,
            color: "var(--text)",
          }}>
            ArvyaX Journal
          </h1>
          <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 28 }}>
            Your AI-assisted nature wellness journal
          </p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Enter your user ID to begin"
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", marginBottom: 12, fontSize: 14 }}
            />
            <button className="btn-primary" type="submit" style={{ width: "100%" }}>
              Enter Journal
            </button>
          </form>
          <p style={{ fontSize: 11, color: "var(--text3)", marginTop: 16 }}>
            Use any identifier — email, username, or a random string.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        position: "sticky",
        top: 0,
        background: "rgba(13,18,8,0.92)",
        backdropFilter: "blur(12px)",
        zIndex: 100,
      }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 400, color: "var(--accent)" }}>
          🌿 ArvyaX
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{userId}</span>
          <button
            className="btn-ghost"
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => {
              localStorage.removeItem("arvyax_uid");
              setUserId("");
              setEntries([]);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        padding: "0 24px",
        background: "var(--bg)",
      }}>
        {["journal", "insights"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab ? "var(--accent)" : "var(--text3)",
              padding: "14px 18px",
              fontSize: 14,
              fontFamily: "var(--font-body)",
              textTransform: "capitalize",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab === "journal" ? "📖 Journal" : "✦ Insights"}
          </button>
        ))}
      </div>

      {/* Content */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px" }}>
        {activeTab === "journal" && (
          <>
            <JournalForm userId={userId} onCreated={handleCreated} />

            {/* Entries */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 300, fontSize: 20, color: "var(--text)" }}>
                Previous Entries
              </h2>
              <button className="btn-ghost" onClick={fetchEntries} disabled={loadingEntries} style={{ fontSize: 12 }}>
                {loadingEntries ? "Loading…" : "↻ Refresh"}
              </button>
            </div>

            {loadingEntries && (
              <p style={{ color: "var(--text3)", fontSize: 14 }}>
                <span className="spinner" /> Loading entries…
              </p>
            )}

            {!loadingEntries && entries.length === 0 && (
              <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text3)" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🌱</div>
                <p>No entries yet. Start by writing your first journal entry above.</p>
              </div>
            )}

            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onAnalyzed={handleAnalyzed}
              />
            ))}
          </>
        )}

        {activeTab === "insights" && (
          <InsightsPanel userId={userId} />
        )}
      </main>
    </div>
  );
}
