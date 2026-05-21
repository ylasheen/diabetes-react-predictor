import { useState, useEffect, useRef } from "react";
import modelData from "./data/model.json";
import { predict } from "./rbf";

// ── Sliders config ────────────────────────────────────
const FIELDS = [
  { key: "pregnancies",  label: "Pregnancies",              unit: "",       min: 0,    max: 17,   step: 1,    default: 3,    icon: "⬡" },
  { key: "glucose",      label: "Glucose",                  unit: "mg/dL",  min: 44,   max: 200,  step: 1,    default: 117,  icon: "◈" },
  { key: "bp",           label: "Blood Pressure",           unit: "mmHg",   min: 24,   max: 122,  step: 1,    default: 72,   icon: "♥" },
  { key: "skin",         label: "Skin Thickness",           unit: "mm",     min: 7,    max: 99,   step: 1,    default: 23,   icon: "◎" },
  { key: "insulin",      label: "Insulin",                  unit: "μU/mL",  min: 14,   max: 846,  step: 1,    default: 30,   icon: "✦" },
  { key: "bmi",          label: "BMI",                      unit: "",       min: 18,   max: 67,   step: 0.1,  default: 32,   icon: "◉" },
  { key: "dpf",          label: "Diabetes Pedigree",        unit: "",       min: 0.08, max: 2.42, step: 0.01, default: 0.47, icon: "⬟" },
  { key: "age",          label: "Age",                      unit: "yrs",    min: 21,   max: 81,   step: 1,    default: 33,   icon: "◇" },
];

// ── Medical report generator ──────────────────────────
function generateReport(vals, prob, pred) {
  const { glucose, bp, bmi, insulin, dpf, age, pregnancies } = vals;
  const findings = [], recs = [];

  if (glucose >= 126) {
    findings.push({ label: "Glucose", value: `${glucose} mg/dL`, status: "critical", note: "Diabetic range (≥126). Fasting hyperglycemia confirmed." });
    recs.push("Immediate endocrinologist referral. HbA1c test required.");
  } else if (glucose >= 100) {
    findings.push({ label: "Glucose", value: `${glucose} mg/dL`, status: "warn", note: "Pre-diabetic range (100–125). Monitor closely." });
    recs.push("Reduce refined sugar intake. Retest fasting glucose in 3 months.");
  } else {
    findings.push({ label: "Glucose", value: `${glucose} mg/dL`, status: "ok", note: "Within normal range." });
  }

  if (bmi >= 30) {
    findings.push({ label: "BMI", value: bmi.toFixed(1), status: "critical", note: "Obese (≥30). Primary modifiable risk factor." });
    recs.push("Structured weight-loss program: target 5–10% body weight reduction.");
  } else if (bmi >= 25) {
    findings.push({ label: "BMI", value: bmi.toFixed(1), status: "warn", note: "Overweight (25–30). Moderate risk elevation." });
    recs.push("150 min/week moderate aerobic exercise recommended.");
  } else {
    findings.push({ label: "BMI", value: bmi.toFixed(1), status: "ok", note: "Healthy range." });
  }

  if (bp >= 90) {
    findings.push({ label: "Blood Pressure", value: `${bp} mmHg`, status: "warn", note: "Elevated. Compounding diabetes risk." });
    recs.push("Daily BP monitoring. Low-sodium diet (<2300 mg/day).");
  } else {
    findings.push({ label: "Blood Pressure", value: `${bp} mmHg`, status: "ok", note: "Normal." });
  }

  if (insulin > 200) {
    findings.push({ label: "Insulin", value: `${insulin} μU/mL`, status: "warn", note: "Elevated. Insulin resistance suspected." });
    recs.push("HOMA-IR test recommended to assess insulin resistance.");
  } else {
    findings.push({ label: "Insulin", value: `${insulin} μU/mL`, status: "ok", note: "Within reference range." });
  }

  if (dpf > 1.0) {
    findings.push({ label: "Diabetes Pedigree", value: dpf.toFixed(3), status: "critical", note: "High genetic susceptibility (>1.0)." });
    recs.push("Screen first-degree relatives. Annual diabetes check mandatory.");
  } else if (dpf > 0.5) {
    findings.push({ label: "Diabetes Pedigree", value: dpf.toFixed(3), status: "warn", note: "Moderate hereditary risk." });
  } else {
    findings.push({ label: "Diabetes Pedigree", value: dpf.toFixed(3), status: "ok", note: "Low hereditary risk." });
  }

  if (age > 45) {
    findings.push({ label: "Age", value: `${age} yrs`, status: "warn", note: "Age >45 is an independent risk factor." });
    recs.push("Annual HbA1c screening recommended for all patients >45.");
  } else {
    findings.push({ label: "Age", value: `${age} yrs`, status: "ok", note: "Age not a major factor currently." });
  }

  if (recs.length === 0) {
    recs.push("Maintain current healthy lifestyle.");
    recs.push("Annual fasting glucose check.");
    recs.push("Regular physical activity ≥150 min/week.");
  }

  return { findings, recs };
}

// ── Gauge SVG ─────────────────────────────────────────
function Gauge({ prob }) {
  const r = 80, cx = 110, cy = 100;
  const startAngle = Math.PI;
  const endAngle = 0;
  const angle = startAngle - prob * Math.PI;

  const arcPath = (start, end, radius) => {
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const large = end - start < Math.PI ? 0 : 1;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 0 ${x2} ${y2}`;
  };

  const fillAngle = startAngle - prob * Math.PI;
  const color = prob < 0.4 ? "#14b8a6" : prob < 0.65 ? "#f59e0b" : "#f43f5e";
  const needleX = cx + (r - 15) * Math.cos(angle);
  const needleY = cy + (r - 15) * Math.sin(angle);

  return (
    <svg viewBox="0 0 220 130" style={{ width: "100%", maxWidth: 280 }}>
      <defs>
        <linearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.3" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Track */}
      <path d={arcPath(Math.PI, 0, r)} fill="none" stroke="url(#trackGrad)" strokeWidth="12" strokeLinecap="round" />

      {/* Fill */}
      {prob > 0.01 && (
        <path d={arcPath(Math.PI, fillAngle, r)} fill="none" stroke={color}
              strokeWidth="12" strokeLinecap="round" filter="url(#glow)" opacity="0.9" />
      )}

      {/* Glow dot */}
      <circle cx={cx + r * Math.cos(fillAngle)} cy={cy + r * Math.sin(fillAngle)}
              r="7" fill={color} filter="url(#glow)" />

      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY}
            stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
      <circle cx={cx} cy={cy} r="5" fill="white" opacity="0.9" />

      {/* Labels */}
      <text x="32" y="118" fill="#14b8a6" fontSize="9" fontFamily="monospace" fontWeight="bold">LOW</text>
      <text x="104" y="100" fill="#f59e0b" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">MED</text>
      <text x="178" y="118" fill="#f43f5e" fontSize="9" fontFamily="monospace" fontWeight="bold">HIGH</text>

      {/* Probability */}
      <text x={cx} y={cy + 30} fill={color} fontSize="22" fontFamily="monospace"
            fontWeight="bold" textAnchor="middle">{(prob * 100).toFixed(1)}%</text>
      <text x={cx} y={cy + 44} fill="#64748b" fontSize="8" fontFamily="monospace"
            textAnchor="middle">DIABETES PROBABILITY</text>
    </svg>
  );
}

// ── Slider component ──────────────────────────────────
function Slider({ field, value, onChange }) {
  const pct = ((value - field.min) / (field.max - field.min)) * 100;
  const color = pct > 75 ? "#f43f5e" : pct > 45 ? "#f59e0b" : "#14b8a6";

  return (
    <div style={{ marginBottom: "1.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#3b82f6", fontSize: "0.75rem" }}>{field.icon}</span>
          <span style={{ color: "#94a3b8", fontSize: "0.8rem", fontFamily: "monospace", letterSpacing: "0.5px" }}>
            {field.label.toUpperCase()}
          </span>
        </div>
        <span style={{ color, fontFamily: "monospace", fontSize: "0.9rem", fontWeight: 700 }}>
          {typeof value === "number" && field.step < 1 ? value.toFixed(2) : value}
          {field.unit && <span style={{ color: "#475569", fontSize: "0.7rem", marginLeft: 3 }}>{field.unit}</span>}
        </span>
      </div>

      <div style={{ position: "relative", height: 6 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: 100,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)"
        }} />
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
          borderRadius: 100, background: `linear-gradient(90deg, ${color}80, ${color})`,
          boxShadow: `0 0 8px ${color}60`, transition: "width 0.15s, background 0.3s"
        }} />
        <input type="range" min={field.min} max={field.max} step={field.step} value={value}
          onChange={e => onChange(field.key, parseFloat(e.target.value))}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "pointer", margin: 0
          }}
        />
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────
export default function App() {
  const defaults = Object.fromEntries(FIELDS.map(f => [f.key, f.default]));
  const [vals, setVals]         = useState(defaults);
  const [result, setResult]     = useState(null);
  const [tab, setTab]           = useState("analysis");
  const [loading, setLoading]   = useState(false);
  const [animated, setAnimated] = useState(false);
  const resultRef = useRef(null);

  const handleChange = (key, val) => setVals(prev => ({ ...prev, [key]: val }));

  const handlePredict = () => {
    setLoading(true);
    setAnimated(false);
    setTimeout(() => {
      const input = FIELDS.map(f => vals[f.key]);
      const res   = predict(input, modelData);
      const rep   = generateReport(vals, res.probability, res.prediction);
      setResult({ ...res, report: rep });
      setLoading(false);
      setTab("analysis");
      setTimeout(() => {
        setAnimated(true);
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, 600);
  };

  const isHigh = result?.prediction === 1;
  const riskColor = isHigh ? "#f43f5e" : "#14b8a6";

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 15% 0%, rgba(59,130,246,0.1) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(6,182,212,0.07) 0%, transparent 55%), #030712",
      color: "#f1f5f9",
      fontFamily: "'Outfit', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #030712; }
        input[type=range]::-webkit-slider-thumb { appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #3b82f6; border: 2px solid rgba(59,130,246,0.5); box-shadow: 0 0 10px rgba(59,130,246,0.5); cursor: pointer; }
        input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #3b82f6; border: 2px solid rgba(59,130,246,0.5); box-shadow: 0 0 10px rgba(59,130,246,0.5); cursor: pointer; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse  { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes spin   { to { transform: rotate(360deg); } }

        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; }
        .card-blue { border-color: rgba(59,130,246,0.2); background: rgba(59,130,246,0.04); }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .tab-btn { background: transparent; border: none; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; padding: 0.45rem 1rem; border-radius: 8px; transition: all 0.2s; letter-spacing: 0.5px; }
        .tab-btn.active { background: rgba(59,130,246,0.15); color: #06b6d4; border: 1px solid rgba(6,182,212,0.25); }
        .tab-btn:not(.active) { color: #475569; }
        .tab-btn:not(.active):hover { color: #94a3b8; background: rgba(255,255,255,0.04); }

        .run-btn { width: 100%; padding: 0.9rem; border: none; border-radius: 14px; cursor: pointer; font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 600; letter-spacing: 0.5px; transition: all 0.3s; background: linear-gradient(135deg, #1d4ed8, #0e7490); color: white; box-shadow: 0 4px 24px rgba(59,130,246,0.3); }
        .run-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(59,130,246,0.45); }
        .run-btn:active { transform: translateY(0); }

        @media (max-width: 768px) {
          .layout { flex-direction: column !important; }
          .sidebar { width: 100% !important; position: static !important; }
          .content { padding: 1rem !important; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .tabs-row { flex-wrap: wrap !important; gap: 4px !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "1rem 2rem", display: "flex", alignItems: "center", gap: 12, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 100, background: "rgba(3,7,18,0.8)" }}>
        <span style={{ fontSize: "1.4rem" }}>🩺</span>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: "1rem", background: "linear-gradient(135deg, #3b82f6, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>DiabetesAI</div>
          <div style={{ color: "#475569", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "1px" }}>RBF NEURAL NETWORK · v2.0</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#14b8a6", boxShadow: "0 0 8px #14b8a6", animation: "pulse 2s infinite" }} />
          <span style={{ color: "#475569", fontSize: "0.72rem", fontFamily: "monospace" }}>LIVE · IN-BROWSER</span>
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="layout" style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>

        {/* ── Sidebar ── */}
        <div className="sidebar card" style={{
          width: 320, flexShrink: 0, borderRadius: 0,
          borderTop: "none", borderBottom: "none", borderLeft: "none",
          padding: "1.8rem 1.4rem", overflowY: "auto",
          position: "sticky", top: 57, height: "calc(100vh - 57px)"
        }}>
          <div style={{ color: "#64748b", fontSize: "0.68rem", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "1.5rem" }}>◈ PATIENT PARAMETERS</div>

          {FIELDS.map(f => (
            <Slider key={f.key} field={f} value={vals[f.key]} onChange={handleChange} />
          ))}

          <button className="run-btn" onClick={handlePredict} disabled={loading}>
            {loading
              ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ display: "inline-block", width: 16, height: 16, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Analyzing...
                </span>
              : "⬡  Run Neural Analysis"
            }
          </button>

          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)", fontFamily: "monospace", fontSize: "0.7rem", color: "#334155", lineHeight: 2.2 }}>
            <span style={{ color: "#3b82f6" }}>Architecture</span>&nbsp; RBF Network<br/>
            <span style={{ color: "#3b82f6" }}>Centers (K)</span>&nbsp;&nbsp; {modelData.centers.length}<br/>
            <span style={{ color: "#3b82f6" }}>Threshold</span>&nbsp;&nbsp;&nbsp; {modelData.threshold.toFixed(2)} (F1)<br/>
            <span style={{ color: "#3b82f6" }}>Inference</span>&nbsp;&nbsp;&nbsp; In-Browser ⚡
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="content" style={{ flex: 1, padding: "2rem 2.5rem", overflowY: "auto" }}>

          {/* Hero */}
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 800, lineHeight: 1.1, background: "linear-gradient(135deg, #e2eaf5 0%, #93c5fd 50%, #67e8f9 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>
              Diabetes Risk Predictor
            </h1>
            <p style={{ color: "#475569", fontSize: "0.9rem", letterSpacing: "0.3px" }}>
              Radial Basis Function Neural Network &nbsp;·&nbsp; Pima Indians Dataset &nbsp;·&nbsp; Explainable AI
            </p>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: "2rem" }}>
            {[
              ["Model", "RBF Network"],
              ["Centers", `K = ${modelData.centers.length}`],
              ["Dataset", "768 records"],
              ["Threshold", modelData.threshold.toFixed(2)],
            ].map(([label, val]) => (
              <div key={label} className="card" style={{ padding: "1rem 1.2rem" }}>
                <div style={{ color: "#475569", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
                <div style={{ color: "#e2eaf5", fontFamily: "'JetBrains Mono', monospace", fontSize: "1.1rem", fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginBottom: "2rem" }} />

          {/* Result */}
          {result ? (
            <div ref={resultRef} className={animated ? "fade-up" : ""}>

              {/* Risk Banner */}
              <div style={{
                background: isHigh ? "rgba(244,63,94,0.06)" : "rgba(20,184,166,0.06)",
                border: `1px solid ${riskColor}30`,
                borderLeft: `3px solid ${riskColor}`,
                borderRadius: 16, padding: "1.4rem 1.8rem",
                marginBottom: "1.5rem",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: "1rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${riskColor}15`, border: `1.5px solid ${riskColor}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: riskColor, flexShrink: 0 }}>
                    {isHigh ? "⚠" : "✓"}
                  </div>
                  <div>
                    <div style={{ fontSize: "1.2rem", fontWeight: 700, color: riskColor }}>{isHigh ? "HIGH RISK — Diabetic" : "LOW RISK — Non-Diabetic"}</div>
                    <div style={{ color: "#64748b", fontSize: "0.8rem", marginTop: 2 }}>Neural analysis complete · RBF confidence score</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "2rem", fontWeight: 700, color: riskColor, lineHeight: 1 }}>
                    {(result.probability * 100).toFixed(1)}%
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: 4 }}>diabetes probability</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs-row" style={{ display: "flex", gap: 6, marginBottom: "1.5rem", background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 5, border: "1px solid rgba(255,255,255,0.06)" }}>
                {[["analysis", "⬡  Neural Analysis"], ["profile", "◈  Feature Profile"], ["report", "✦  Clinical Report"]].map(([key, label]) => (
                  <button key={key} className={`tab-btn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
                ))}
              </div>

              {/* Tab: Analysis */}
              {tab === "analysis" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                  <div className="card" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ color: "#64748b", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "1rem", alignSelf: "flex-start" }}>◈ PROBABILITY GAUGE</div>
                    <Gauge prob={result.probability} />
                  </div>
                  <div className="card" style={{ padding: "1.5rem" }}>
                    <div style={{ color: "#64748b", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "1.2rem" }}>◈ CONFIDENCE BREAKDOWN</div>
                    {[
                      { label: "Diabetic", val: result.probability, color: "#f43f5e" },
                      { label: "Non-Diabetic", val: result.probNo, color: "#14b8a6" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ marginBottom: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ color: "#94a3b8", fontSize: "0.82rem" }}>{label}</span>
                          <span style={{ fontFamily: "monospace", color, fontWeight: 700 }}>{(val * 100).toFixed(1)}%</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 100, height: 8, overflow: "hidden" }}>
                          <div style={{ width: `${val * 100}%`, height: "100%", borderRadius: 100, background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}60`, transition: "width 1s ease" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[["🔴 Diabetic", result.probability, "#f43f5e"], ["🟢 Non-Diabetic", result.probNo, "#14b8a6"]].map(([label, val, color]) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "0.9rem", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
                          <div style={{ color: "#64748b", fontSize: "0.7rem", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontFamily: "monospace", fontSize: "1.3rem", fontWeight: 700, color }}>{(val * 100).toFixed(1)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Feature Profile */}
              {tab === "profile" && (
                <div className="card" style={{ padding: "1.5rem" }}>
                  <div style={{ color: "#64748b", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "1.5rem" }}>◈ BIOMARKER SUMMARY</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.8rem" }}>
                    {FIELDS.map(f => {
                      const val = vals[f.key];
                      const pct = Math.min((val - f.min) / (f.max - f.min), 1);
                      const color = pct > 0.75 ? "#f43f5e" : pct > 0.45 ? "#f59e0b" : "#14b8a6";
                      return (
                        <div key={f.key} style={{ padding: "0.9rem 1.1rem", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{f.icon} {f.label}</span>
                            <span style={{ fontFamily: "monospace", color, fontWeight: 700, fontSize: "0.85rem" }}>
                              {f.step < 1 ? val.toFixed(2) : val}{f.unit ? ` ${f.unit}` : ""}
                            </span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 100, height: 5 }}>
                            <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 100, background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 6px ${color}50` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab: Clinical Report */}
              {tab === "report" && (
                <div style={{ display: "grid", gap: "1.2rem" }}>
                  <div className="card" style={{ padding: "1.5rem" }}>
                    <div style={{ color: "#64748b", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "1.2rem" }}>◈ CLINICAL FINDINGS</div>
                    {result.report.findings.map((f, i) => {
                      const color = f.status === "critical" ? "#f43f5e" : f.status === "warn" ? "#f59e0b" : "#14b8a6";
                      const icon  = f.status === "critical" ? "⚠" : f.status === "warn" ? "△" : "✓";
                      return (
                        <div key={i} style={{ display: "flex", gap: 12, padding: "0.85rem 1rem", borderRadius: 10, background: `${color}08`, border: `1px solid ${color}20`, marginBottom: 8 }}>
                          <span style={{ color, fontSize: "0.9rem", flexShrink: 0, marginTop: 1 }}>{icon}</span>
                          <div>
                            <span style={{ color, fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 600 }}>{f.label}</span>
                            <span style={{ color: "#64748b", fontSize: "0.78rem" }}> · {f.value}</span>
                            <div style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: 3 }}>{f.note}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="card" style={{ padding: "1.5rem" }}>
                    <div style={{ color: "#64748b", fontSize: "0.65rem", fontFamily: "monospace", letterSpacing: "2px", marginBottom: "1.2rem" }}>◈ HEALTH RECOMMENDATIONS</div>
                    {result.report.recs.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "0.75rem 1rem", borderRadius: 10, background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", marginBottom: 8 }}>
                        <span style={{ color: "#3b82f6", flexShrink: 0 }}>→</span>
                        <span style={{ color: "#cbd5e1", fontSize: "0.85rem", lineHeight: 1.5 }}>{r}</span>
                      </div>
                    ))}
                  </div>

                  <div className="card" style={{ padding: "1.2rem 1.5rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#334155", lineHeight: 1.8 }}>
                    <span style={{ color: "#3b82f6" }}>MODEL REASONING</span> · RBF Network assessed {modelData.centers.length} K-Means cluster centers.
                    Gaussian activations mapped the 8-feature vector to a {modelData.centers.length}-dimensional space.
                    Logistic Regression classified at F1-optimized threshold {modelData.threshold.toFixed(2)}.
                    Confidence: {(result.probability * 100).toFixed(1)}% · Inference: in-browser (zero latency).
                  </div>

                  <div style={{ textAlign: "center", padding: "0.8rem", background: "rgba(244,63,94,0.04)", borderRadius: 10, border: "1px solid rgba(244,63,94,0.1)", color: "#64748b", fontSize: "0.75rem" }}>
                    ⚠ AI-generated assessment — not a substitute for professional medical diagnosis.
                  </div>
                </div>
              )}
            </div>

          ) : (
            // Welcome state
            <div>
              <div className="card" style={{ padding: "3.5rem 2rem", textAlign: "center", marginBottom: "1.5rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "1.2rem" }}>🩺</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 600, color: "#e2eaf5", marginBottom: 8 }}>Neural System Ready</div>
                <div style={{ color: "#475569", fontSize: "0.88rem", lineHeight: 1.8, maxWidth: 400, margin: "0 auto" }}>
                  Configure patient biomarkers in the sidebar,<br/>
                  then click <span style={{ color: "#06b6d4", fontWeight: 600 }}>Run Neural Analysis</span>.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                {[
                  ["⬡", "#3b82f6", "RBF Network", "Manual Gaussian activation network with K-Means derived centers."],
                  ["◈", "#06b6d4", "In-Browser AI", "Model runs entirely in your browser — zero server, zero latency."],
                  ["✦", "#8b5cf6", "F1-Optimized", "Threshold tuned via F1-Score for optimal precision-recall balance."],
                ].map(([icon, color, title, desc]) => (
                  <div key={title} className="card" style={{ padding: "1.4rem" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: "1.1rem", marginBottom: "0.9rem" }}>{icon}</div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 6 }}>{title}</div>
                    <div style={{ color: "#475569", fontSize: "0.8rem", lineHeight: 1.6 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "3rem", padding: "1.5rem 0 0.5rem", textAlign: "center", color: "#1e293b", fontSize: "0.72rem", fontFamily: "monospace", letterSpacing: "0.5px" }}>
            DiabetesAI · RBF Neural Network · Pima Indians Dataset · Built for Portfolio
          </div>
        </div>
      </div>
    </div>
  );
}
