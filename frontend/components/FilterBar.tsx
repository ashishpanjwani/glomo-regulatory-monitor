"use client";

export type Filters = {
  source: string;
  relevance: string;
  reviewed: string;
  datePreset: string;
};

type Props = {
  filters: Filters;
  onChange: (filters: Filters) => void;
  total: number;
};

const RELEVANCE_DOTS: Record<string, string> = {
  HIGH: "#EF4444",
  MEDIUM: "#F97316",
  LOW: "#EAB308",
  NOT_RELEVANT: "#9CA3AF",
};

const SOURCE_LABELS: Record<string, string> = { ALL: "All", RBI: "RBI", IFSCA: "IFSCA" };
const STATUS_LABELS: Record<string, string> = { ALL: "All", UNREVIEWED: "Unreviewed", REVIEWED: "Reviewed" };

const DATE_PRESETS = ["ALL", "7D", "30D", "3M", "6M"];
const DATE_PRESET_LABELS: Record<string, string> = {
  ALL: "Any time",
  "7D": "Last 7 days",
  "30D": "Last 30 days",
  "3M": "Last 3 months",
  "6M": "Last 6 months",
};

export default function FilterBar({ filters, onChange, total }: Props) {
  const set = (key: keyof Filters, value: string) => onChange({ ...filters, [key]: value });

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, flexShrink: 0 }}>
        {total} circulars
      </span>

      <Divider />

      <PillTabGroup
        label="Source"
        value={filters.source}
        options={["ALL", "RBI", "IFSCA"]}
        labelMap={SOURCE_LABELS}
        onChange={(v) => set("source", v)}
      />

      <Divider />

      <RelevanceDropdown
        value={filters.relevance}
        onChange={(v) => set("relevance", v)}
        dotMap={RELEVANCE_DOTS}
      />

      <Divider />

      <PillTabGroup
        label="Status"
        value={filters.reviewed}
        options={["ALL", "UNREVIEWED", "REVIEWED"]}
        labelMap={STATUS_LABELS}
        onChange={(v) => set("reviewed", v)}
      />

      <Divider />

      {/* Date preset */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
          textTransform: "uppercase", color: "var(--muted)",
        }}>
          Date
        </span>
        <select
          value={filters.datePreset}
          onChange={(e) => set("datePreset", e.target.value)}
          style={{
            fontSize: 12, fontWeight: 500, fontFamily: "inherit",
            borderRadius: 8, border: "1px solid var(--border)",
            background: filters.datePreset !== "ALL" ? "#F5FFDC" : "var(--surface)",
            color: "var(--ink)",
            padding: "5px 26px 5px 10px",
            appearance: "none", cursor: "pointer", outline: "none",
          }}
        >
          {DATE_PRESETS.map((p) => (
            <option key={p} value={p}>{DATE_PRESET_LABELS[p]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: "var(--border)", flexShrink: 0 }} />;
}

function PillTabGroup({ label, value, options, labelMap, onChange }: {
  label: string;
  value: string;
  options: string[];
  labelMap: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--muted)",
      }}>
        {label}
      </span>
      <div style={{
        display: "flex", alignItems: "center",
        background: "var(--surface)", borderRadius: 9,
        border: "1px solid var(--border)", padding: 3, gap: 2,
      }}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                padding: "4px 11px", borderRadius: 7,
                border: "none", cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12, fontWeight: active ? 700 : 500,
                background: active ? "var(--card)" : "transparent",
                color: active ? "var(--ink)" : "var(--muted)",
                boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "background 0.12s, color 0.12s, box-shadow 0.12s",
              }}
            >
              {labelMap[opt] ?? opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RelevanceDropdown({ value, onChange, dotMap }: {
  value: string;
  onChange: (v: string) => void;
  dotMap: Record<string, string>;
}) {
  const dot = value !== "ALL" ? dotMap[value] : null;
  const OPTIONS = ["ALL", "HIGH", "MEDIUM", "LOW", "NOT_RELEVANT"];
  const LABELS: Record<string, string> = {
    ALL: "All relevance",
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low",
    NOT_RELEVANT: "Not Relevant",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: "var(--muted)",
      }}>
        Relevance
      </span>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {dot && (
          <span style={{
            position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            width: 7, height: 7, borderRadius: "50%",
            background: dot, pointerEvents: "none", zIndex: 1,
          }} />
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            fontSize: 12, fontWeight: 500, fontFamily: "inherit",
            borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--ink)",
            paddingTop: 5, paddingBottom: 5,
            paddingLeft: dot ? 22 : 10,
            paddingRight: 26,
            appearance: "none", cursor: "pointer", outline: "none",
          }}
        >
          {OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{LABELS[opt]}</option>
          ))}
        </select>
        <svg
          style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            width: 11, height: 11, pointerEvents: "none", color: "var(--muted)",
          }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
