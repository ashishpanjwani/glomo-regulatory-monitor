"use client";

import { useState } from "react";

type Props = {
  apiUrl: string;
  onDone: () => void;
};

export default function FetchButton({ apiUrl, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<{ new_circulars: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    setLast(null);
    try {
      const res = await fetch(`${apiUrl}/fetch`, { method: "POST" });
      const data = await res.json();
      setLast(data);
      onDone();
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {last && !loading && (
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {last.new_circulars === 0 ? "Already up to date" : `+${last.new_circulars} new`}
        </span>
      )}
      <button
      onClick={handleFetch}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 18px",
        borderRadius: 12,
        border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
        background: hovered && !loading ? "var(--lime-dark)" : "var(--lime)",
        color: "var(--ink)",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        transition: "background 0.15s",
      }}
    >
      {loading ? (
        <>
          <svg style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }}
            viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Fetching…
        </>
      ) : (
        <>
          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Fetch Now
        </>
      )}
    </button>
    </div>
  );
}
