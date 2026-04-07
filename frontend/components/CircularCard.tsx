"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Circular = {
  id: string;
  source: "RBI" | "IFSCA";
  title: string;
  url: string;
  published_at: string | null;
  summary: string | null;
  why_it_matters: string | null;
  relevance_score: "HIGH" | "MEDIUM" | "LOW" | "NOT_RELEVANT" | null;
  action_items: { action: string; deadline: string }[];
  is_reviewed: boolean;
  analyzed_at: string | null;
};

type Props = {
  circular: Circular;
  onClose: () => void;
  onToggleReview: (id: string) => void;
  onRescrape: (id: string) => void;
};

const RC: Record<string, { label: string; labelBg: string; labelColor: string }> = {
  HIGH:         { label: "High",         labelBg: "#FEF2F2", labelColor: "#B91C1C" },
  MEDIUM:       { label: "Medium",       labelBg: "#FFF7ED", labelColor: "#C2410C" },
  LOW:          { label: "Low",          labelBg: "#FEFCE8", labelColor: "#A16207" },
  NOT_RELEVANT: { label: "Not Relevant", labelBg: "#F9FAFB", labelColor: "#6B7280" },
};

const SC: Record<string, { bg: string; color: string }> = {
  RBI:   { bg: "#F0FDF4", color: "#15803D" },
  IFSCA: { bg: "#EFF6FF", color: "#1D4ED8" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CircularDrawer({ circular, onClose, onToggleReview, onRescrape }: Props) {
  const [rescraping, setRescraping] = useState(false);
  // TODO: remove the ID override once this circular is re-analyzed
  const analysisFaild = (!!circular.analyzed_at && !circular.relevance_score)
    || circular.id === "78b1dfa2-3bbe-47a9-9f04-8978e23827b9";
  const rel = circular.relevance_score ?? "LOW";
  const rc = RC[rel] ?? RC.LOW;
  const sc = SC[circular.source] ?? SC.RBI;
  const reviewed = circular.is_reviewed;

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 60,
      height: "calc(100vh - 60px)",
      width: 480,
      background: "var(--card)",
      borderLeft: "1px solid var(--border)",
      boxShadow: "-6px 0 32px rgba(200, 241, 53, 0.07), -16px 0 48px rgba(0,0,0,0.06)",
      zIndex: 50,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: reviewed ? "#F0FDF4" : "var(--card)",
        flexShrink: 0,
      }}>
        {/* Top row: badges + close button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <Badge bg={sc.bg} color={sc.color}>{circular.source}</Badge>
            {circular.relevance_score && (
              <Badge bg={rc.labelBg} color={rc.labelColor}>{rc.label}</Badge>
            )}
            {reviewed && <Badge bg="#DCFCE7" color="#15803D">Reviewed ✓</Badge>}
            <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {formatDate(circular.published_at)}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              border: "none",
              background: "var(--surface)",
              borderRadius: 7,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Title */}
        <p style={{
          margin: 0, fontSize: 15, fontWeight: 600,
          color: reviewed ? "var(--muted)" : "var(--ink)",
          lineHeight: 1.4,
        }}>
          {circular.title}
        </p>
      </div>

      {/* Body — scrollable */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "20px",
        display: "flex", flexDirection: "column", gap: 20,
      }}>
        {analysisFaild ? (
          <div style={{
            padding: "16px", borderRadius: 10,
            background: "#FFFBEB", border: "1px solid #FDE68A",
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#92400E" }}>
              Automatic analysis could not be completed
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#78350F", lineHeight: 1.6 }}>
              The source website did not return extractable content for this circular — this typically happens when the document is behind a login wall, returns an HTML page instead of a PDF, or the text could not be parsed. The circular needs to be reviewed manually.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "#78350F", lineHeight: 1.6 }}>
              Use <strong>View original</strong> below to open the circular directly on the IFSCA website, or click <strong>Re-analyze</strong> to attempt another fetch — useful if the issue was temporary.
            </p>
          </div>
        ) : (
          <>
            {circular.summary && <Section label="Summary" body={circular.summary} />}

            {circular.why_it_matters && (
              <Section label="Why it matters to Glomopay" body={circular.why_it_matters} />
            )}

            {circular.action_items?.length > 0 && (
              <div>
                <p style={{
                  margin: "0 0 10px",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--muted)",
                }}>
                  Action items
                </p>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {circular.action_items.map((item, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13 }}>
                      <span style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                        background: "var(--lime)", color: "var(--ink)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, marginTop: 1,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ color: "var(--ink-soft)", lineHeight: 1.55 }}>
                        {item.action}
                        {item.deadline && (
                          <span style={{
                            marginLeft: 8,
                            display: "inline-block",
                            padding: "1px 7px", borderRadius: 10,
                            background: "#FEFCE8", color: "#A16207",
                            fontSize: 11, fontWeight: 600,
                          }}>
                            {item.deadline}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {!circular.analyzed_at && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
                Analysis in progress…
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 20px",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
        background: "var(--card)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href={circular.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, fontWeight: 500, color: "var(--ink-soft)",
              textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
          >
            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View original
          </a>
          {analysisFaild && (
            <button
              disabled={rescraping}
              onClick={async () => {
                setRescraping(true);
                await fetch(`${API_URL}/circulars/${circular.id}/rescrape`, { method: "POST" });
                onRescrape(circular.id);
                setRescraping(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 7,
                border: "1px solid #FDE68A",
                background: "#FFFBEB",
                color: rescraping ? "var(--muted)" : "#92400E",
                fontSize: 11, fontWeight: 500, cursor: rescraping ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              <svg style={{ width: 11, height: 11, animation: rescraping ? "spin 1s linear infinite" : "none" }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {rescraping ? "Re-fetching…" : "Re-analyze"}
            </button>
          )}
        </div>

        <label style={{
          display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer", userSelect: "none",
          padding: "6px 14px", borderRadius: 8,
          background: reviewed ? "#DCFCE7" : "var(--surface)",
          border: reviewed ? "1px solid #BBF7D0" : "1px solid var(--border)",
          transition: "background 0.15s, border-color 0.15s",
        }}>
          <input
            type="checkbox"
            checked={reviewed}
            onChange={() => onToggleReview(circular.id)}
            style={{ accentColor: "#C8F135", width: 14, height: 14, cursor: "pointer" }}
          />
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: reviewed ? "#15803D" : "var(--ink-soft)",
          }}>
            {reviewed ? "Reviewed ✓" : "Mark as reviewed"}
          </span>
        </label>
      </div>
    </div>
  );
}

function Badge({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
      padding: "2px 8px", borderRadius: 20,
      background: bg, color,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p style={{
        margin: "0 0 5px",
        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--muted)",
      }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.65 }}>
        {body}
      </p>
    </div>
  );
}
