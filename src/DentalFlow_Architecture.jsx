import { useState } from "react";

const layers = [
  {
    id: "qbo",
    label: "QuickBooks Online",
    color: "#2CA01C",
    icon: "🔗",
    x: 50, y: 40, w: 200, h: 64,
    details: {
      title: "QBO Integration Layer",
      points: [
        "OAuth 2.0 authorization code flow",
        "Scopes: com.intuit.quickbooks.accounting",
        "Full sync (12 mo history) on connect",
        "Webhook-based incremental sync",
        "Proactive token refresh at 50-min mark",
        "Endpoints: Purchase, Deposit, Transfer, Account, Vendor",
      ],
    },
  },
  {
    id: "sync",
    label: "Sync Engine",
    color: "#E67E22",
    icon: "🔄",
    x: 50, y: 140, w: 200, h: 64,
    details: {
      title: "Data Sync Pipeline",
      points: [
        "Redis + BullMQ job queue",
        "Webhook receiver for real-time events",
        "Daily batch reconciliation job",
        "Deduplication by qbo_txn_id",
        "Raw JSON preserved for audit trail",
        "Rate limiting per Intuit guidelines",
      ],
    },
  },
  {
    id: "db",
    label: "PostgreSQL + Redis",
    color: "#336791",
    icon: "🗄️",
    x: 310, y: 140, w: 200, h: 64,
    details: {
      title: "Data Layer",
      points: [
        "PostgreSQL 16 with JSONB columns",
        "Tables: practices, transactions, categorizations, user_rules, review_sessions, forecasts",
        "Row-level security scoped to practice_id",
        "AES-256-GCM encrypted token storage",
        "Redis for token cache + job queue",
        "Full audit logging on all mutations",
      ],
    },
  },
  {
    id: "rules",
    label: "Tier 1: Rules",
    color: "#8E44AD",
    icon: "📋",
    x: 50, y: 250, w: 140, h: 64,
    details: {
      title: "Deterministic Rule Engine",
      points: [
        "Catches 55–65% of transactions",
        "50+ dental vendor rules (Henry Schein, Patterson, etc.)",
        "Practice software detection (Dentrix, Eaglesoft)",
        "Payroll processor matching",
        "Personal subscription filtering",
        "Address-based rent/mortgage classification",
      ],
    },
  },
  {
    id: "ml",
    label: "Tier 2: ML Model",
    color: "#C0392B",
    icon: "🤖",
    x: 210, y: 250, w: 140, h: 64,
    details: {
      title: "ML Classification Service",
      points: [
        "Python FastAPI microservice",
        "Fine-tuned DistilBERT for text classification",
        "Features: merchant name, memo, amount, timing",
        "Temporal pattern detection (recurring charges)",
        "Dental-specific amount heuristics",
        "Cross-account correlation analysis",
      ],
    },
  },
  {
    id: "feedback",
    label: "Tier 3: User Loop",
    color: "#16A085",
    icon: "👤",
    x: 370, y: 250, w: 140, h: 64,
    details: {
      title: "User Feedback Loop",
      points: [
        "Every correction creates a user-specific rule",
        "Aggregated corrections retrain ML model quarterly",
        "Confidence scores drive UI treatment",
        "90–100%: auto-categorized (green)",
        "70–89%: suggested, soft confirm (yellow)",
        "Below 70%: must review (orange/red)",
      ],
    },
  },
  {
    id: "review",
    label: "Review Interface",
    color: "#2980B9",
    icon: "✅",
    x: 130, y: 360, w: 260, h: 64,
    details: {
      title: "Transaction Review UI",
      points: [
        "Split-panel: transaction list + detail view",
        "Sorted by confidence (lowest first)",
        "Keyboard shortcuts: B/P/S/R + arrows",
        "Batch mode for same-vendor transactions",
        "Split transaction support (% allocation)",
        "Create Rule directly from any transaction",
        "Monthly review workflow with progress bar",
      ],
    },
  },
  {
    id: "forecast",
    label: "Forecasting Engine",
    color: "#D35400",
    icon: "📈",
    x: 130, y: 460, w: 260, h: 64,
    details: {
      title: "Cash Flow Forecasting",
      points: [
        "Business-only transactions (post-review)",
        "Holt-Winters triple exponential smoothing",
        "Dental seasonality: summer dip, year-end surge",
        "Scenario modeling with adjustable sliders",
        "Key metrics: cash runway, overhead ratio, collection ratio",
        "80% and 95% confidence intervals",
        "Export: PDF, CSV, QBO journal entries",
      ],
    },
  },
];

const connections = [
  { from: "qbo", to: "sync", label: "Webhooks + API" },
  { from: "sync", to: "db", label: "Store" },
  { from: "db", to: "rules", label: "" },
  { from: "db", to: "ml", label: "" },
  { from: "rules", to: "review", label: "" },
  { from: "ml", to: "review", label: "" },
  { from: "feedback", to: "review", label: "" },
  { from: "review", to: "forecast", label: "Confirmed txns" },
  { from: "review", to: "feedback", label: "Corrections" },
];

function getCenter(layer) {
  return { x: layer.x + layer.w / 2, y: layer.y + layer.h / 2 };
}

const phases = [
  { label: "Phase 1 (Wk 1–4)", desc: "QBO connect, sync, Tier 1 rules, basic review UI", color: "#2CA01C" },
  { label: "Phase 2 (Wk 5–8)", desc: "ML classification, full review UI, feedback loop", color: "#E67E22" },
  { label: "Phase 3 (Wk 9–12)", desc: "Forecasting, budgets, dashboard, exports", color: "#C0392B" },
  { label: "Phase 4 (Wk 13–16)", desc: "Multi-practice, accountant portal, benchmarks", color: "#8E44AD" },
];

export default function DentalFlowArch() {
  const [selected, setSelected] = useState(null);
  const [hoveredLayer, setHoveredLayer] = useState(null);
  const sel = layers.find(l => l.id === selected);

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', 'SF Pro Display', system-ui, sans-serif", background: "#0a0f1a", color: "#e0e6ed", minHeight: "100vh", padding: "24px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: 4, letterSpacing: "-0.5px" }}>
          <span style={{ color: "#4ecdc4" }}>DentalFlow</span> Pro — System Architecture
        </h1>
        <p style={{ color: "#7a8a9e", fontSize: 14, marginBottom: 28 }}>Click any component to explore details. Arrows show data flow direction.</p>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 560px" }}>
            <svg viewBox="0 0 560 560" style={{ width: "100%", background: "#0d1420", borderRadius: 12, border: "1px solid #1a2538" }}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#3a4f6a" />
                </marker>
              </defs>
              {connections.map((conn, i) => {
                const from = layers.find(l => l.id === conn.from);
                const to = layers.find(l => l.id === conn.to);
                const fc = getCenter(from);
                const tc = getCenter(to);
                const isHighlighted = hoveredLayer === conn.from || hoveredLayer === conn.to;
                return (
                  <g key={i}>
                    <line x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y} stroke={isHighlighted ? "#4ecdc4" : "#1e3048"} strokeWidth={isHighlighted ? 2 : 1.5} markerEnd="url(#arrowhead)" strokeDasharray={isHighlighted ? "none" : "6,4"} style={{ transition: "all 0.3s" }} />
                    {conn.label && (
                      <text x={(fc.x + tc.x) / 2} y={(fc.y + tc.y) / 2 - 6} fill="#5a7a9a" fontSize="9" textAnchor="middle">{conn.label}</text>
                    )}
                  </g>
                );
              })}
              {layers.map(layer => {
                const isHovered = hoveredLayer === layer.id;
                const isSelected = selected === layer.id;
                return (
                  <g
                    key={layer.id}
                    style={{ cursor: "pointer", transition: "transform 0.2s" }}
                    onClick={() => setSelected(selected === layer.id ? null : layer.id)}
                    onMouseEnter={() => setHoveredLayer(layer.id)}
                    onMouseLeave={() => setHoveredLayer(null)}
                  >
                    <rect
                      x={layer.x} y={layer.y} width={layer.w} height={layer.h} rx={10}
                      fill={isSelected ? layer.color + "30" : isHovered ? layer.color + "20" : "#111b2a"}
                      stroke={isSelected ? layer.color : isHovered ? layer.color + "88" : "#1e3048"}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                      style={{ transition: "all 0.2s" }}
                    />
                    <text x={layer.x + 36} y={layer.y + 28} fill={isSelected || isHovered ? "#fff" : "#c0cdd8"} fontSize="13" fontWeight="600" style={{ transition: "fill 0.2s" }}>
                      {layer.label}
                    </text>
                    <text x={layer.x + 12} y={layer.y + 32} fontSize="16">{layer.icon}</text>
                    {isSelected && (
                      <circle cx={layer.x + layer.w - 12} cy={layer.y + 12} r={4} fill={layer.color} />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {sel ? (
              <div style={{ background: "#111b2a", borderRadius: 12, border: `1px solid ${sel.color}44`, padding: 20, animation: "fadeIn 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 22 }}>{layers.find(l => l.id === selected)?.icon}</span>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: sel.color, margin: 0 }}>{sel.details.title}</h2>
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 18px", listStyle: "none" }}>
                  {sel.details.points.map((p, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#b8c8d8", marginBottom: 4, position: "relative", paddingLeft: 14 }}>
                      <span style={{ position: "absolute", left: 0, color: sel.color }}>›</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{ background: "#111b2a", borderRadius: 12, border: "1px solid #1e3048", padding: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: "#4ecdc4", margin: "0 0 14px 0" }}>Implementation Phases</h2>
                {phases.map((p, i) => (
                  <div key={i} style={{ marginBottom: 12, paddingLeft: 14, borderLeft: `3px solid ${p.color}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "#7a8a9e", marginTop: 2 }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, background: "#111b2a", borderRadius: 12, border: "1px solid #1e3048", padding: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e0e6ed", margin: "0 0 10px 0" }}>Key Decisions</h3>
              <div style={{ fontSize: 12, color: "#7a8a9e", lineHeight: 1.8 }}>
                <div style={{ marginBottom: 6 }}><span style={{ color: "#4ecdc4" }}>●</span> Start read-only from QBO; add write-back in Phase 3</div>
                <div style={{ marginBottom: 6 }}><span style={{ color: "#E67E22" }}>●</span> DistilBERT for Tier 2 ML; reserve LLM for explanations</div>
                <div style={{ marginBottom: 6 }}><span style={{ color: "#C0392B" }}>●</span> Holt-Winters forecasting with dental seasonality</div>
                <div><span style={{ color: "#8E44AD" }}>●</span> Tiered pricing: $49 / $99 / $199 per month</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
