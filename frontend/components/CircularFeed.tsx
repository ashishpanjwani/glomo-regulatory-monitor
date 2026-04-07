"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CircularDrawer, { type Circular } from "./CircularCard";
import FetchButton from "./FetchButton";
import FilterBar, { type Filters } from "./FilterBar";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PAGE_SIZE = 25;

const RELEVANCE_DOT: Record<string, string> = {
  HIGH:         "#EF4444",
  MEDIUM:       "#F97316",
  LOW:          "#EAB308",
  NOT_RELEVANT: "#9CA3AF",
};

const RELEVANCE_LABEL: Record<string, string> = {
  HIGH: "High", MEDIUM: "Medium", LOW: "Low", NOT_RELEVANT: "Not Relevant",
};

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  RBI:   { bg: "#F0FDF4", color: "#15803D" },
  IFSCA: { bg: "#EFF6FF", color: "#1D4ED8" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

function StatPill({ count, label, color, bg }: { count: number; label: string; color: string; bg: string }) {
  if (count === 0) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 11px", borderRadius: 20,
      background: bg, fontSize: 12, fontWeight: 600, color,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{count}</span>
      {label}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Build page numbers: always show first, last, current ±1, with ellipsis
  const pages: (number | "…")[] = [];
  const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
  add(1);
  if (page > 3) pages.push("…");
  if (page > 2) add(page - 1);
  add(page);
  if (page < totalPages - 1) add(page + 1);
  if (page < totalPages - 2) pages.push("…");
  add(totalPages);

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    minWidth: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
    fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
    transition: "background 0.1s, color 0.1s",
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginTop: 14, flexWrap: "wrap", gap: 8,
    }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>
        {from}–{to} of {total}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          style={{
            ...btnBase,
            padding: "0 10px",
            background: "var(--card)",
            color: page === 1 ? "var(--muted)" : "var(--ink)",
            cursor: page === 1 ? "not-allowed" : "pointer",
            opacity: page === 1 ? 0.5 : 1,
          }}
        >
          ← Prev
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: "var(--muted)", padding: "0 4px" }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              style={{
                ...btnBase,
                padding: "0 4px",
                background: p === page ? "var(--lime)" : "var(--card)",
                color: p === page ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: p === page ? 700 : 500,
                borderColor: p === page ? "var(--lime-dark)" : "var(--border)",
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          style={{
            ...btnBase,
            padding: "0 10px",
            background: "var(--card)",
            color: page === totalPages ? "var(--muted)" : "var(--ink)",
            cursor: page === totalPages ? "not-allowed" : "pointer",
            opacity: page === totalPages ? 0.5 : 1,
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function TableRow({
  circular,
  isSelected,
  onClick,
  isLast,
}: {
  circular: Circular;
  isSelected: boolean;
  onClick: () => void;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const rel = circular.relevance_score;
  const dot = rel ? RELEVANCE_DOT[rel] : "#9CA3AF";
  const label = rel ? RELEVANCE_LABEL[rel] : "—";
  const sc = SOURCE_COLORS[circular.source] ?? SOURCE_COLORS.RBI;

  const rowBg = isSelected
    ? "#F5FFDC"
    : hovered
    ? "var(--surface)"
    : circular.is_reviewed
    ? "#FAFAF8"
    : "var(--card)";

  const tdBase: React.CSSProperties = {
    padding: "11px 14px",
    verticalAlign: "middle",
    borderBottom: isLast ? "none" : "1px solid var(--border)",
  };

  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: "pointer",
        background: rowBg,
        transition: "background 0.1s",
        boxShadow: isSelected ? "inset 3px 0 0 var(--lime)" : "none",
      }}
    >
      {/* Date */}
      <td style={{ ...tdBase, width: 95, whiteSpace: "nowrap", fontSize: 12, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
        {formatDate(circular.published_at)}
      </td>

      {/* Source */}
      <td style={{ ...tdBase, width: 80 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.03em",
          padding: "2px 8px", borderRadius: 20,
          background: sc.bg, color: sc.color,
          textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          {circular.source}
        </span>
      </td>

      {/* Title */}
      <td style={{ ...tdBase, maxWidth: 0 }}>
        <div style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 13,
          fontWeight: rel === "HIGH" ? 600 : rel === "MEDIUM" ? 500 : 400,
          color: circular.is_reviewed ? "var(--muted)" : rel === "NOT_RELEVANT" ? "var(--ink-soft)" : "var(--ink)",
        }}>
          {circular.title}
        </div>
      </td>

      {/* Relevance */}
      <td style={{ ...tdBase, width: 130, whiteSpace: "nowrap" }}>
        {rel ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-soft)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, display: "inline-block" }} />
            {label}
          </span>
        ) : !circular.analyzed_at ? (
          <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Analyzing…</span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
        )}
      </td>

      {/* Status */}
      <td style={{ ...tdBase, width: 100, whiteSpace: "nowrap" }}>
        {circular.is_reviewed ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D" }}>Done ✓</span>
        ) : !circular.analyzed_at ? (
          <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>Pending</span>
        ) : !circular.relevance_score ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#B45309" }}>Failed</span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
        )}
      </td>
    </tr>
  );
}

const POLL_INTERVAL_MS = 4000;

export default function CircularFeed() {
  const [circulars, setCirculars] = useState<Circular[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    source: "ALL",
    relevance: "ALL",
    reviewed: "ALL",
    datePreset: "ALL",
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Silent refresh — does not show loading spinner, merges in new analysis results
  const refreshCirculars = useCallback(async (f: Filters, p: number) => {
    const params = new URLSearchParams();
    if (f.source !== "ALL") params.set("source", f.source);
    if (f.relevance !== "ALL") params.set("relevance", f.relevance);
    if (f.reviewed === "REVIEWED") params.set("reviewed", "true");
    if (f.reviewed === "UNREVIEWED") params.set("reviewed", "false");
    if (f.datePreset !== "ALL") {
      const days = { "7D": 7, "30D": 30, "3M": 90, "6M": 180 }[f.datePreset];
      if (days) {
        const from = new Date();
        from.setDate(from.getDate() - days);
        params.set("date_from", from.toISOString().slice(0, 10));
      }
    }
    params.set("page", String(p));
    params.set("page_size", String(PAGE_SIZE));

    try {
      const res = await fetch(`${API_URL}/circulars?${params}`);
      const data = await res.json();
      setCirculars(data.items ?? []);
      setTotal(data.total ?? 0);
      setLastFetchedAt((prev) => prev ?? new Date());
    } catch {
      // silently ignore poll errors
    }
  }, []);

  const fetchCirculars = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    try {
      await refreshCirculars(f, p);
    } finally {
      setLoading(false);
    }
  }, [refreshCirculars]);

  useEffect(() => {
    fetchCirculars(filters, page);
  }, [filters, page, fetchCirculars]);

  // Auto-poll while any circulars on this page are still being analyzed
  const hasPending = circulars.some((c) => !c.analyzed_at);
  const filtersRef = useRef(filters);
  const pageRef = useRef(page);
  filtersRef.current = filters;
  pageRef.current = page;

  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => refreshCirculars(filtersRef.current, pageRef.current), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasPending, refreshCirculars]);

  // Re-render every 30s so "Last checked X min ago" stays current
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const handleFiltersChange = (f: Filters) => {
    setSelectedId(null);
    setPage(1);
    setFilters(f);
  };

  const handlePageChange = (p: number) => {
    setSelectedId(null);
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFetchDone = () => {
    setLastFetchedAt(new Date());
    setTimeout(() => refreshCirculars(filtersRef.current, pageRef.current), 1000);
  };

  const handleToggleReview = async (id: string) => {
    await fetch(`${API_URL}/circulars/${id}/review`, { method: "PATCH" });
    setCirculars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_reviewed: !c.is_reviewed } : c))
    );
  };

  const handleSelectRow = (id: string) =>
    setSelectedId((prev) => (prev === id ? null : id));

  const selectedCircular = circulars.find((c) => c.id === selectedId) ?? null;

  // Stats are across total (not just current page) — fetch separately only if needed.
  // For now, count from current page items (good enough indicator).
  const counts = {
    HIGH:         circulars.filter((c) => c.relevance_score === "HIGH").length,
    MEDIUM:       circulars.filter((c) => c.relevance_score === "MEDIUM").length,
    LOW:          circulars.filter((c) => c.relevance_score === "LOW").length,
    NOT_RELEVANT: circulars.filter((c) => c.relevance_score === "NOT_RELEVANT").length,
    analyzing:    circulars.filter((c) => !c.analyzed_at).length,
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 14px",
    textAlign: "left",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    color: "var(--muted)",
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto",
          padding: "0 24px", height: 60,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "var(--lime)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: "var(--ink)", flexShrink: 0,
            }}>
              ✦
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", lineHeight: 1.2 }}>
                Regulatory Monitor
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.2 }}>
                Glomo
              </div>
            </div>
          </div>
          <FetchButton apiUrl={API_URL} onDone={handleFetchDone} />
        </div>
      </header>

      {/* ── Filter bar ── */}
      <div style={{
        position: "sticky", top: 60, zIndex: 10,
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 24px",
      }}>
        <FilterBar filters={filters} onChange={handleFiltersChange} total={total} />
      </div>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "20px 24px" }}>

        {/* Digest stats bar */}
        {!loading && circulars.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between", flexWrap: "wrap",
            gap: 8, marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <StatPill count={counts.HIGH}         label="High"         color="#B91C1C" bg="#FEF2F2" />
              <StatPill count={counts.MEDIUM}       label="Medium"       color="#C2410C" bg="#FFF7ED" />
              <StatPill count={counts.LOW}          label="Low"          color="#A16207" bg="#FEFCE8" />
              <StatPill count={counts.NOT_RELEVANT} label="Not Relevant" color="#6B7280" bg="#F3F4F6" />
              {counts.analyzing > 0 && (
                <StatPill count={counts.analyzing}  label="Analyzing…"   color="#999990" bg="#F5F5F2" />
              )}
            </div>
            {lastFetchedAt && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                Last checked {relativeTime(lastFetchedAt)}
              </span>
            )}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--muted)", fontSize: 14 }}>
            <svg
              style={{ display: "block", margin: "0 auto 12px", width: 20, height: 20, animation: "spin 1s linear infinite" }}
              viewBox="0 0 24 24" fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading…
          </div>
        ) : circulars.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div style={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              overflow: "hidden",
              background: "var(--card)",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Source</th>
                    <th style={thStyle}>Title</th>
                    <th style={thStyle}>Relevance</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {circulars.map((c, i) => (
                    <TableRow
                      key={c.id}
                      circular={c}
                      isSelected={selectedId === c.id}
                      onClick={() => handleSelectRow(c.id)}
                      isLast={i === circulars.length - 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onChange={handlePageChange}
            />
          </>
        )}
      </main>

      {/* ── Right drawer ── */}
      {selectedCircular && (
        <CircularDrawer
          circular={selectedCircular}
          onClose={() => setSelectedId(null)}
          onToggleReview={handleToggleReview}
          onRescrape={() => setTimeout(() => refreshCirculars(filtersRef.current, pageRef.current), 1000)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "96px 0" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: "var(--lime)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, margin: "0 auto 18px",
      }}>
        ✦
      </div>
      <p style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)", margin: 0 }}>
        No circulars yet
      </p>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
        Click <strong style={{ color: "var(--ink)" }}>Fetch Now</strong> to pull the latest from RBI and IFSCA.
      </p>
    </div>
  );
}
