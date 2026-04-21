const { useState, useEffect, useMemo, useCallback, useRef } = React;

// ─── UTILS ───
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

// ─── ANIMATION HOOK ───
// Detects value changes and returns a temporary inline style object to create a "pulse" effect
function useFlash(value, type = "text", skipInitial = true) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(value);
  const isInitial = useRef(skipInitial);

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      prev.current = value;
      return;
    }
    if (prev.current !== value) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 200); // Quick active state
      prev.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  if (!flash) return { transition: "all 0.8s ease-out" }; // Long fade out

  if (type === "tab") return {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "#fff",
    textShadow: "0 0 8px #fff",
    transition: "none" // Instant flash
  };

  // Default text flash
  return {
    color: "#fff",
    textShadow: "0 0 10px rgba(255, 255, 255, 0.8)",
    transition: "none"
  };
}

// ─── PERSISTENT STORAGE ───
async function loadState() {
  try {
    const r = localStorage.getItem("harari-dashboard-state");
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

async function saveState(state) {
  try {
    localStorage.setItem("harari-dashboard-state", JSON.stringify(state));
  } catch (e) { 
    console.error("Storage save failed:", e); 
  }
}

// ─── CONSTANTS ───
const FIRE_TARGETS = { aggressive: 550000, recommended: 625000, bulletproof: 700000 };

const PHASES = {
  employed: {
    id: "employed", label: "Employed", subtitle: "Accumulating — salary flowing",
    icon: "▲", color: "#2563eb",
    buckets: {
      growth:     { target: 84, range: [82,87], floor: null,  note: "VWCE core. Single provider OK below €500k." },
      fortress:   { target: 7,  range: [6,8],   floor: 30000, note: "~16–18 months expenses. Draw first if laid off." },
      termShield: { target: 5,  range: [4,6],   floor: 18000, note: "29GA until Q1 2029, then reassess instrument." },
      cash:       { target: 4,  range: [0,5],   floor: null,  note: "DCA deployment buffer — drive toward 0%." },
    },
  },
  laid_off: {
    id: "laid_off", label: "Laid Off", subtitle: "No income — fortress mode",
    icon: "■", color: "#dc2626",
    buckets: {
      growth:     { target: 82, range: [78,85], floor: null,  note: "DO NOT SELL. Freeze. Let it compound." },
      fortress:   { target: 10, range: [8,12],  floor: 35000, note: "Severance lands here. Draw first." },
      termShield: { target: 5,  range: [4,7],   floor: 18000, note: "Draw second, after fortress depleted." },
      cash:       { target: 3,  range: [1,5],   floor: null,  note: "Severance overflow + operating liquidity." },
    },
  },
  coast_fire: {
    id: "coast_fire", label: "Coast FIRE", subtitle: "Part-time income + portfolio growth",
    icon: "◇", color: "#8b5cf6",
    buckets: {
      growth:     { target: 78, range: [72,82], floor: null,  note: "Multi-provider. Split VWCE / SPYI above €500k." },
      fortress:   { target: 10, range: [8,12],  floor: 40000, note: "24 months net draw locked in." },
      termShield: { target: 8,  range: [6,10],  floor: 25000, note: "Years 2–4 bridge. Rolling ladder." },
      cash:       { target: 4,  range: [2,5],   floor: null,  note: "Opportunity fund — deploy on 15%+ drawdowns." },
    },
  },
  full_fire: {
    id: "full_fire", label: "Full FIRE", subtitle: "Living off the portfolio",
    icon: "★", color: "#f59e0b",
    buckets: {
      growth:     { target: 72, range: [65,78], floor: null,  note: "Multi-provider mandatory. Rebalance annually." },
      fortress:   { target: 12, range: [10,14], floor: 50000, note: "24–30 months expenses. Non-negotiable floor." },
      termShield: { target: 10, range: [8,12],  floor: 35000, note: "Years 2–4 rolling ladder." },
      cash:       { target: 6,  range: [4,8],   floor: null,  note: "3–6 months immediate liquidity + opportunity." },
    },
  },
};

const BUCKET_META = {
  growth:     { label: "Growth (VWCE)",  inst: "VWCE", color: "#2563eb", short: "Compounding machine. Never sell in drawdowns." },
  fortress:   { label: "Safety (XEON)",  inst: "XEON (€STR ~2.3%)",        color: "#059669", short: "Liquidity. Layoff runway years 0–2." },
  termShield: { label: "Runway (29GA)",    inst: "29GA → successor bond ETF", color: "#d97706", short: "Medium-term runway years 2–4." },
  cash:       { label: "Cash",  inst: "EUR cash at IBKR",         color: "#6b7280", short: "DCA buffer or opportunity fund." },
};

const TRIGGERS = [
  { event: "Layoff confirmed", action: "Cancel DCA → route cash to XEON. Switch to Laid Off phase. Do NOT sell VWCE.", urgency: "immediate", category: "employment" },
  { event: "Portfolio hits €500k", action: "Split new DCA: 60% VWCE / 40% SPYI or ISAC for provider diversification.", urgency: "month", category: "milestone" },
  { event: "Portfolio hits €625k", action: "FIRE-Ready. Fortress floor → €50k. Decide: keep working or transition?", urgency: "month", category: "milestone" },
  { event: "Art. 13 repealed (10% CGT)", action: "April 2026 reset is safe. Activate Beckham Law research → decide within 60 days.", urgency: "quarter", category: "tax" },
  { event: "€STR drops below 1.5%", action: "Review XEON yield. Consider short-dated EUR govt bond ETF alternative.", urgency: "quarter", category: "market" },
  { event: "March 2029 — 29GA dissolution", action: "Sell 29GA on BVME.ETF via directed limit order. Do NOT wait for December.", urgency: "immediate", category: "calendar" },
  { event: "Market drawdown > 25%", action: "Deploy strategic cash into growth. Do NOT touch fortress or term shield.", urgency: "week", category: "market" },
  { event: "Daughter starts private school", action: "Add €10–13k/yr to expenses. Recalculate SWR. If > 4.0%, wife's income becomes mandatory.", urgency: "month", category: "life" },
  { event: "Wife starts earning income", action: "Reduce fortress floor by ~50% of her annual. Accelerate growth. Recalculate FIRE.", urgency: "quarter", category: "life" },
  { event: "New employment in Spain", action: "File Beckham Law (Form 149) within 6 months of entering Spanish Social Security.", urgency: "immediate", category: "relocation" },
];

// ─── COMPONENTS ───
function Num({ children, color = "#fff", size = 20, mono = true }) {
  return <span style={{ fontSize: size, fontWeight: 700, color, fontFamily: mono ? "monospace" : "inherit", lineHeight: 1 }}>{children}</span>;
}

function SWRBadge({ swr, size = "large" }) {
  const isLg = size === "large";
  let bg, label;
  
  if (swr <= 0) { bg = "#555"; label = "INVALID"; }
  else if (swr > 6.0) { bg = "#991b1b"; label = "CATASTROPHIC"; }
  else if (swr > 4.5) { bg = "#dc2626"; label = "DANGER"; }
  else if (swr > 3.8) { bg = "#d97706"; label = "ELEVATED"; }
  else if (swr > 3.2) { bg = "#2563eb"; label = "TARGET"; }
  else { bg = "#059669"; label = "SAFE"; }
  
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isLg ? "flex-end" : "flex-start", gap: 2 }}>
      <span style={{ fontSize: isLg ? 28 : 20, fontWeight: 800, color: flashStyle.color || bg, fontFamily: "monospace", lineHeight: 1, transition: flashStyle.transition, textShadow: flashStyle.textShadow }}>
        {swr > 0 ? `${swr.toFixed(2)}%` : "N/A"}
      </span>
      <span style={{ fontSize: 9, color: bg, fontWeight: 700, letterSpacing: "0.1em" }}>{label} SWR</span>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, format, color = "#2563eb", suffix = "" }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#888" }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "monospace" }}>{format ? format(value) : value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, height: 4 }} />
    </div>
  );
}

function Card({ children, style = {}, highlight = false }) {
  return (
    <div style={{
      background: "#111", border: `1px solid ${highlight ? "#333" : "#1a1a1a"}`,
      borderRadius: 10, padding: "18px 20px", ...style,
    }}>{children}</div>
  );
}

function BucketRow({ bucketKey, alloc, portfolioValue }) {
  const m = BUCKET_META[bucketKey];
  const eurVal = Math.round(portfolioValue * alloc.target / 100);
  const floorActive = alloc.floor && eurVal < alloc.floor;
  const effectiveEur = floorActive ? alloc.floor : eurVal;
  const pct = Math.min((alloc.target / 100) * 100, 100);
  
  const valFlash = useFlash(effectiveEur, "text");
  const pctFlash = useFlash(alloc.target, "text");

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ width: 4, height: 44, borderRadius: 2, background: m.color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>{m.label}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 11, color: valFlash.color || "#666", fontFamily: "monospace", transition: valFlash.transition, textShadow: valFlash.textShadow }}>€{effectiveEur.toLocaleString()}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: pctFlash.color || m.color, fontFamily: "monospace", transition: pctFlash.transition, textShadow: pctFlash.textShadow }}>{alloc.target}%</span>
          </div>
        </div>
        <div style={{ width: "100%", height: 4, background: "#1a1a1a", borderRadius: 2, marginTop: 6 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: m.color, borderRadius: 2, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#666" }}>{alloc.note}</span>
          {floorActive && <span style={{ fontSize: 10, color: "#f87171", fontWeight: 700, fontFamily: "monospace" }}>FLOOR OVERRIDE</span>}
        </div>
      </div>
    </div>
  );
}

function ProjectionRow({ label, months, eurVal, target, color }) {
  const flashStyle = useFlash(months, "text");

  if (months === null || months === Infinity) return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #111" }}>
      <span style={{ fontSize: 12, color: "#888" }}>{label} <span style={{ fontSize: 11, color: "#555" }}>€{target.toLocaleString()}</span></span>
      <span style={{ fontSize: 12, color: flashStyle.color || "#555", fontFamily: "monospace", transition: flashStyle.transition, textShadow: flashStyle.textShadow }}>Already passed</span>
    </div>
  );
  
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const dateStr = date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #111" }}>
      <span style={{ fontSize: 12, color: "#888" }}>{label} <span style={{ fontSize: 11, color: "#555" }}>€{target.toLocaleString()}</span></span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12, color: flashStyle.color || "#555", fontFamily: "monospace", transition: flashStyle.transition, textShadow: flashStyle.textShadow }}>{months} mo</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: flashStyle.color || color, fontFamily: "monospace", transition: flashStyle.transition, textShadow: flashStyle.textShadow }}>{dateStr}</span>
      </div>
    </div>
  );
}

// ─── MAIN ───
function Dashboard() {
  const { width } = useWindowSize();
  const isMobile = width <= 768;

  const [portfolio, setPortfolio] = useState(470000); 
  const [phase, setPhase] = useState("employed");
  
  // Operating Levers
  const [monthlyContrib, setMonthlyContrib] = useState(6000);
  const [annualExpense, setAnnualExpense] = useState(20000);
  const [wifeIncome, setWifeIncome] = useState(0);
  const [schoolCost, setSchoolCost] = useState(0);
  const [antiAtrophy, setAntiAtrophy] = useState(5000);
  const [travelBudget, setTravelBudget] = useState(4000);
  const [resortFees, setResortFees] = useState(1000);

  // Capital Levers
  const [buildCost, setBuildCost] = useState(250000);
  const [resortCost, setResortCost] = useState(100000);

  const [bgTax10, setBgTax10] = useState(false);
  const [realReturn, setRealReturn] = useState(5);
  const [showTriggers, setShowTriggers] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("runway");

  useEffect(() => {
    (async () => {
      const s = await loadState();
      if (s) {
        if (s.portfolio) setPortfolio(s.portfolio);
        if (s.phase) setPhase(s.phase);
        if (s.monthlyContrib !== undefined) setMonthlyContrib(s.monthlyContrib);
        if (s.annualExpense) setAnnualExpense(s.annualExpense);
        if (s.wifeIncome !== undefined) setWifeIncome(s.wifeIncome);
        if (s.schoolCost !== undefined) setSchoolCost(s.schoolCost);
        if (s.antiAtrophy !== undefined) setAntiAtrophy(s.antiAtrophy);
        if (s.travelBudget !== undefined) setTravelBudget(s.travelBudget);
        if (s.resortFees !== undefined) setResortFees(s.resortFees);
        if (s.buildCost !== undefined) setBuildCost(s.buildCost);
        if (s.resortCost !== undefined) setResortCost(s.resortCost);
        if (s.bgTax10 !== undefined) setBgTax10(s.bgTax10);
        if (s.realReturn !== undefined) setRealReturn(s.realReturn);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      saveState({ 
        portfolio, phase, monthlyContrib, annualExpense, wifeIncome, 
        schoolCost, antiAtrophy, travelBudget, resortFees, buildCost, 
        resortCost, bgTax10, realReturn 
      });
    }, 500);
    return () => clearTimeout(t);
  }, [loaded, portfolio, phase, monthlyContrib, annualExpense, wifeIncome, schoolCost, antiAtrophy, travelBudget, resortFees, buildCost, resortCost, bgTax10, realReturn]);

  const phaseData = PHASES[phase];
  const bucketKeys = ["growth", "fortress", "termShield", "cash"];

  // ─── OPTION MATRICES ───
  const plovGross = annualExpense + antiAtrophy + schoolCost;
  const plovIncomeOffset = wifeIncome * 12;
  const plovNetDraw = Math.max(0, plovGross - plovIncomeOffset);
  const plovTaxDrag = bgTax10 ? plovNetDraw * 0.5 * 0.10 : 0;
  const plovTotal = plovNetDraw + plovTaxDrag;
  const plovSWR = portfolio > 0 ? (plovTotal / portfolio) * 100 : 0;

  const buildCapital = portfolio - buildCost;
  const buildSWR = buildCapital > 0 ? (plovTotal / buildCapital) * 100 : 0;

  const resortCapital = portfolio - resortCost;
  const resortNetDraw = plovTotal + resortFees;
  const resortSWR = resortCapital > 0 ? (resortNetDraw / resortCapital) * 100 : 0;

  const travelNetDraw = plovTotal + travelBudget;
  const travelSWR = portfolio > 0 ? (travelNetDraw / portfolio) * 100 : 0;

  const valBase = 36000;
  const valTotal = valBase + schoolCost;
  const valSWR = portfolio > 0 ? (valTotal / portfolio) * 100 : 0;

  const fortressEur = Math.max(phaseData.buckets.fortress.floor || 0, Math.round(portfolio * phaseData.buckets.fortress.target / 100));
  const termEur = Math.max(phaseData.buckets.termShield.floor || 0, Math.round(portfolio * phaseData.buckets.termShield.target / 100));
  const cashEur = Math.round(portfolio * phaseData.buckets.cash.target / 100);
  const monthlyBurn = plovTotal / 12;
  const runwayMonths = monthlyBurn > 0 ? Math.round((fortressEur + termEur + cashEur) / monthlyBurn) : 999;

  const monthsTo = useCallback((target) => {
    if (portfolio >= target) return null;
    const r = realReturn / 100 / 12;
    const c = monthlyContrib;
    for (let n = 1; n <= 360; n++) {
      const fv = portfolio * Math.pow(1 + r, n) + c * (Math.pow(1 + r, n) - 1) / (r || 0.0001);
      if (fv >= target) return n;
    }
    return 360;
  }, [portfolio, realReturn, monthlyContrib]);

  const projections = useMemo(() => ({
    p500: monthsTo(500000),
    aggressive: monthsTo(FIRE_TARGETS.aggressive),
    recommended: monthsTo(FIRE_TARGETS.recommended),
    bulletproof: monthsTo(FIRE_TARGETS.bulletproof),
  }), [monthsTo]);

  const fireGap = Math.max(0, FIRE_TARGETS.recommended - portfolio);
  const fireProgress = Math.min(100, (portfolio / FIRE_TARGETS.recommended) * 100);

  // ─── FLASH HOOKS ───
  const portFlash = useFlash(portfolio, "text");
  const gapFlash = useFlash(fireGap, "text");
  const runFlash = useFlash(runwayMonths, "text");
  const swrFlash = useFlash(plovSWR, "text");

  const pctFlash = useFlash(fireProgress, "text");
  const mosFlash = useFlash(projections.recommended, "text");

  // Determine when to flash the tabs by hashing their dependency variables
  const runHash = `${phase}-${portfolio}-${annualExpense}-${antiAtrophy}-${schoolCost}-${wifeIncome}-${buildCost}-${resortCost}-${travelBudget}-${resortFees}-${bgTax10}`;
  const allocHash = `${phase}-${portfolio}`;
  const projHash = `${portfolio}-${monthlyContrib}-${realReturn}`;

  const runTabFlash = useFlash(runHash, "tab");
  const allocTabFlash = useFlash(allocHash, "tab");
  const projTabFlash = useFlash(projHash, "tab");

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#555", fontSize: 13 }}>Loading saved state...</span>
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#ddd",
      fontFamily: "'IBM Plex Sans', 'SF Pro Text', -apple-system, sans-serif",
      padding: isMobile ? "16px 12px 30px" : "20px 16px 40px",
    }}>
      <div style={{ maxWidth: 840, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#444", textTransform: "uppercase", fontFamily: "monospace" }}>
            PORTFOLIO OPERATING SYSTEM
          </div>
          <h1 style={{ fontSize: isMobile ? 22 : 24, fontWeight: 800, color: "#fff", margin: "4px 0 0", letterSpacing: "-0.03em" }}>
            Financial Command Center
          </h1>
          <p style={{ fontSize: 12, color: "#555", margin: "4px 0 0" }}>
            State persists between sessions. Update portfolio value monthly after checking IBKR.
          </p>
        </div>

        {/* TOP STRIP METRICS */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Portfolio", value: `€${(portfolio/1000).toFixed(0)}k`, color: "#fff", f: portFlash },
            { label: "FIRE Gap", value: fireGap > 0 ? `€${(fireGap/1000).toFixed(0)}k` : "DONE", color: fireGap > 0 ? "#f59e0b" : "#059669", f: gapFlash },
            { label: "Runway", value: `${runwayMonths} mo`, color: runwayMonths > 36 ? "#059669" : runwayMonths > 18 ? "#d97706" : "#dc2626", f: runFlash },
            { label: "Plovdiv SWR", value: `${plovSWR.toFixed(1)}%`, color: plovSWR > 4.5 ? "#dc2626" : plovSWR > 3.8 ? "#d97706" : "#059669", f: swrFlash },
          ].map((s, i) => (
            <div key={i} style={{ background: "#111", borderRadius: 8, padding: "12px 14px", border: "1px solid #1a1a1a" }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.f.color || s.color, fontFamily: "monospace", lineHeight: 1, transition: s.f.transition, textShadow: s.f.textShadow }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* PROGRESS BAR */}
        <div style={{ marginBottom: 24, padding: "0 2px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginBottom: 4, fontFamily: "monospace" }}>
            <span>€0</span>
            <span>FIRE €625k</span>
          </div>
          <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, position: "relative", overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(fireProgress, 100)}%`, height: "100%", borderRadius: 4,
              background: fireProgress >= 100 ? "#059669" : `linear-gradient(90deg, #2563eb, ${fireProgress > 85 ? "#059669" : "#2563eb"})`,
              transition: "width 0.5s ease",
            }} />
            {[550, 625, 700].map(t => {
              const pos = (t / 750) * 100;
              return pos < 98 ? (
                <div key={t} style={{ position: "absolute", left: `${Math.min(pos, 95)}%`, top: 0, height: "100%", width: 1, background: "#333" }} />
              ) : null;
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#444", marginTop: 3, fontFamily: "monospace" }}>
            <span style={{ color: pctFlash.color, transition: pctFlash.transition, textShadow: pctFlash.textShadow }}>{fireProgress.toFixed(0)}% of target</span>
            <span style={{ color: mosFlash.color, transition: mosFlash.transition, textShadow: mosFlash.textShadow }}>{projections.recommended !== null ? `~${projections.recommended} months to go` : "Target reached"}</span>
          </div>
        </div>

        {/* PHASE SELECTOR */}
        <div style={{ display: "flex", gap: isMobile ? 8 : 6, marginBottom: 20, flexWrap: "wrap" }}>
          {Object.entries(PHASES).map(([key, p]) => (
            <button key={key} onClick={() => setPhase(key)} style={{
              padding: isMobile ? "10px 14px" : "7px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
              border: phase === key ? "1px solid #fff" : "1px solid #222",
              background: phase === key ? "#fff" : "transparent",
              color: phase === key ? "#000" : "#666",
              fontSize: 12, fontWeight: phase === key ? 700 : 500,
              transition: "all 0.15s", flex: isMobile ? "1 1 calc(50% - 8px)" : "initial"
            }}>
              <span style={{ marginRight: 5, opacity: 0.6 }}>{p.icon}</span>{p.label}
            </button>
          ))}
        </div>

        {/* TAB SWITCHER */}
        <div style={{ 
          display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #222", 
          overflowX: "auto", whiteSpace: "nowrap", WebkitOverflowScrolling: "touch"
        }}>
          {[
            { key: "runway", label: "Runway & Levers", flashStyle: runTabFlash },
            { key: "allocator", label: "Allocation", flashStyle: allocTabFlash },
            { key: "projection", label: "Projection", flashStyle: projTabFlash },
          ].map(t => {
            const isActive = tab === t.key;
            const appliedFlash = !isActive ? t.flashStyle : { transition: "all 0.15s" };
            
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: isMobile ? "12px 16px" : "10px 20px", border: "none",
                background: appliedFlash.backgroundColor || "transparent",
                borderBottom: isActive ? "2px solid #fff" : "2px solid transparent",
                color: isActive ? "#fff" : (appliedFlash.color || "#555"),
                textShadow: appliedFlash.textShadow || "none",
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit", flexShrink: 0, 
                borderRadius: "6px 6px 0 0", transition: appliedFlash.transition
              }}>{t.label}</button>
            )
          })}
        </div>

        {/* TABS */}
        {tab === "runway" && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 28 }}>
            
            {/* LEVERS COLUMN */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card highlight>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Capital Levers</h3>
                <Slider label="Liquid Portfolio Value" value={portfolio} onChange={setPortfolio} min={200000} max={1000000} step={5000} color="#fff" format={v => `€${v.toLocaleString()}`} />
                <Slider label="Monthly Contributions" value={monthlyContrib} onChange={setMonthlyContrib} min={0} max={10000} step={500} color="#2563eb" format={v => `€${v.toLocaleString()}`} suffix="/mo" />
                <div style={{ height: 1, background: "#222", margin: "16px 0" }} />
                <Slider label="Asenovgrad Build Cost" value={buildCost} onChange={setBuildCost} min={150000} max={400000} step={10000} color="#f59e0b" format={v => `€${v.toLocaleString()}`} />
                <Slider label="Resort Apartment Cost" value={resortCost} onChange={setResortCost} min={50000} max={200000} step={5000} color="#059669" format={v => `€${v.toLocaleString()}`} />
              </Card>

              <Card highlight>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Operating Expense Levers</h3>
                <Slider label="Base Annual Expenses" value={annualExpense} onChange={setAnnualExpense} min={15000} max={40000} step={1000} color="#ef4444" format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                <Slider label="Anti-Atrophy Local Services" value={antiAtrophy} onChange={setAntiAtrophy} min={0} max={15000} step={500} color="#8b5cf6" format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                <Slider label="Flexible Travel Budget" value={travelBudget} onChange={setTravelBudget} min={0} max={15000} step={500} color="#ec4899" format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                <Slider label="Resort Annual Fees" value={resortFees} onChange={setResortFees} min={0} max={3000} step={100} color="#d97706" format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                <Slider label="Private School Cost" value={schoolCost} onChange={setSchoolCost} min={0} max={15000} step={1000} color="#10b981" format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                <Slider label="Wife's Coaching Income" value={wifeIncome} onChange={setWifeIncome} min={0} max={1500} step={50} color="#2563eb" format={v => `€${v}`} suffix="/mo" />

                <div style={{ marginTop: 8, padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, borderLeft: "3px solid #8b5cf6" }}>
                  <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
                    <strong style={{ color: "#ccc" }}>Anti-Atrophy Protocol:</strong> Pulse membership, slow travel, social infrastructure. Vital requirement for stability/stimulation constraint. Budget accordingly.
                  </div>
                </div>
              </Card>
            </div>

            {/* GEOGRAPHIC ARBITRAGE COLUMN */}
            <Card highlight>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Geographic Arbitrage Scenarios</h3>
                <button onClick={() => setBgTax10(!bgTax10)} style={{
                  padding: isMobile ? "8px 12px" : "5px 10px", border: "none", borderRadius: 5, cursor: "pointer",
                  background: bgTax10 ? "#7f1d1d" : "#065f46", color: bgTax10 ? "#fca5a5" : "#6ee7b7",
                  fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                }}>
                  {bgTax10 ? "BG 10% CGT" : "BG 0% CGT"}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                
                {/* STATUS QUO */}
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: `1px solid ${bgTax10 ? "#7f1d1d44" : "#222"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>1. Plovdiv Status Quo</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Net draw: €{plovTotal.toLocaleString()}/yr</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>Zero capital risk. Optimal financially, but fails social and stimulation constraints without heavy anti-atrophy spend.</div>
                    </div>
                    <SWRBadge swr={plovSWR} size="small" />
                  </div>
                </div>

                {/* VALENCIA */}
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: "1px solid #1e3a8a" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>2. Valencia Relocation</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Net draw: €{valTotal.toLocaleString()}/yr <span style={{ color: "#2563eb", fontWeight: 700 }}>Beckham Law</span></div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>The structural endgame. Requires qualifying Spanish contract first to shield equity portfolio.</div>
                    </div>
                    <SWRBadge swr={valSWR} size="small" />
                  </div>
                </div>

                {/* ASENOVGRAD */}
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: "1px solid #222" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>3. Asenovgrad Build</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Capital Base: €{Math.max(0, buildCapital).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>Concentrates capital risk. Extreme construction stress. Exacerbates rural isolation.</div>
                    </div>
                    <SWRBadge swr={buildSWR} size="small" />
                  </div>
                </div>

                {/* RESORT */}
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: "1px solid #222" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>4. Resort Apartment</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Capital Base: €{Math.max(0, resortCapital).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>High logistical friction (packing/driving). Off-season boredom (Pamporovo) or toxic smog (Velingrad).</div>
                    </div>
                    <SWRBadge swr={resortSWR} size="small" />
                  </div>
                </div>

                {/* FLEXIBLE TRAVEL */}
                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: "1px solid #222" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>5. Flexible Travel</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Net draw: €{travelNetDraw.toLocaleString()}/yr</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>Financially optimal. High chaos and transient lifestyle. Fails to build permanent local community.</div>
                    </div>
                    <SWRBadge swr={travelSWR} size="small" />
                  </div>
                </div>

              </div>
              
              <div style={{ marginTop: 16, padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, fontSize: 11, color: "#888", lineHeight: 1.6 }}>
                <strong>Recommendation: The Sequenced Hybrid.</strong> Optimize Plovdiv status quo with targeted premium anti-atrophy spend during the income gap. Trigger Valencia relocation <em>only</em> upon securing an employment contract to activate the Beckham Law shield.
              </div>
            </Card>
          </div>
        )}

        {/* TAB: ALLOCATOR */}
        {tab === "allocator" && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", border: "1px solid #222", marginBottom: 16 }}>
              {bucketKeys.map(k => {
                const t = phaseData.buckets[k].target;
                return t > 0 ? (
                  <div key={k} style={{
                    width: `${t}%`, background: BUCKET_META[k].color, display: "flex",
                    alignItems: "center", justifyContent: "center", borderRight: "1px solid #0a0a0a", transition: "width 0.4s ease"
                  }}>
                    {t >= 6 && <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: "monospace" }}>{t}%</span>}
                  </div>
                ) : null;
              })}
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              {bucketKeys.filter(k => phaseData.buckets[k].target > 0).map(k => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: BUCKET_META[k].color }} />
                  <span style={{ fontSize: 11, color: "#888" }}>{BUCKET_META[k].label}</span>
                </div>
              ))}
            </div>

            <Card>
              {bucketKeys.map(k => <BucketRow key={k} bucketKey={k} alloc={phaseData.buckets[k]} portfolioValue={portfolio} />)}
            </Card>

            <Card style={{ marginTop: 12, borderLeft: "3px solid #dc2626" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Hard Rules</div>
              {[
                "Fortress has a euro FLOOR. If % gives less than floor, fund to floor.",
                "Never sell Growth in a drawdown. That's what Fortress exists for.",
                "Rebalance with new money only. Exception: annual rebalance post-FIRE.",
                "All sells direct-routed to IBIS/IBIS2 or BVME.ETF. No SMART on sells.",
                "Review this framework in September annually. No mid-year impulse changes.",
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, color: "#999", lineHeight: 1.5 }}>
                  <span style={{ color: "#444", fontFamily: "monospace", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{r}</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* TAB: PROJECTION */}
        {tab === "projection" && (
          <div style={{ marginBottom: 28 }}>
            <Card highlight style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>Projection Inputs</h3>
              <Slider label="Monthly Contributions" value={monthlyContrib} onChange={setMonthlyContrib} min={0} max={10000} step={500} color="#2563eb" format={v => `€${v.toLocaleString()}`} suffix="/mo" />
              <Slider label="Expected Real Return" value={realReturn} onChange={setRealReturn} min={2} max={10} step={0.5} color="#059669" format={v => `${v.toFixed(1)}`} suffix="% / yr" />
              <div style={{ fontSize: 10, color: "#555", marginTop: -8 }}>
                5% real = ~7-8% nominal minus 2-3% inflation. Conservative for 80%+ equity.
              </div>
            </Card>

            <Card>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "0 0 12px" }}>Time to FIRE Milestones</h3>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 12 }}>
                {monthlyContrib > 0 ? "Assumes continued employment + contributions." : "No contributions (laid off / FIRE). Growth only."}
              </div>

              <ProjectionRow label="Coast FIRE" months={projections.p500} target={500000} color="#2563eb" />
              <ProjectionRow label="Aggressive FIRE" months={projections.aggressive} target={FIRE_TARGETS.aggressive} color="#d97706" />
              <ProjectionRow label="Recommended FIRE (3.5% SWR)" months={projections.recommended} target={FIRE_TARGETS.recommended} color="#059669" />
              <ProjectionRow label="Bulletproof FIRE" months={projections.bulletproof} target={FIRE_TARGETS.bulletproof} color="#8b5cf6" />

              <div style={{ marginTop: 16, padding: "12px 14px", background: "#1a1a1a", borderRadius: 6, borderLeft: "3px solid #dc2626" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fca5a5", marginBottom: 6 }}>Layoff Scenario (€0 contributions)</div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6 }}>
                  {(() => {
                    const r = realReturn / 100 / 12;
                    let n625 = null;
                    for (let n = 1; n <= 360; n++) {
                      if (portfolio * Math.pow(1 + r, n) >= FIRE_TARGETS.recommended) { n625 = n; break; }
                    }
                    const d = new Date(); d.setMonth(d.getMonth() + (n625 || 0));
                    return n625
                      ? `At ${realReturn}% real return with zero contributions, portfolio reaches €625k in ~${n625} months (${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}). Runway covers ${runwayMonths} months — ${runwayMonths > n625 ? "runway outlasts the gap." : "gap exceeds runway. Wife's income or part-time work needed."}`
                      : `At current portfolio and return assumptions, €625k is not reached within 30 years without contributions.`;
                  })()}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TRIGGERS */}
        <button onClick={() => setShowTriggers(!showTriggers)} style={{
          width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8,
          padding: isMobile ? "16px" : "12px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showTriggers ? 10 : 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa" }}>Decision Triggers ({TRIGGERS.length})</span>
          <span style={{ fontSize: 16, color: "#555", transition: "transform 0.2s", transform: showTriggers ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
        </button>

        {showTriggers && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {TRIGGERS.map((t, i) => {
              const colors = { employment: "#dc2626", milestone: "#2563eb", tax: "#d97706", market: "#059669", calendar: "#8b5cf6", life: "#f59e0b", relocation: "#ec4899" };
              const urgColors = { immediate: "#7f1d1d", week: "#78350f", month: "#1e3a5f", quarter: "#1a2e1a" };
              const urgLabels = { immediate: "ACT NOW", week: "THIS WEEK", month: "THIS MONTH", quarter: "THIS QTR" };
              return (
                <div key={i} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 6, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: colors[t.category] || "#555" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#eee" }}>{t.event}</span>
                    </div>
                    <span style={{
                      padding: "2px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                      background: urgColors[t.urgency] || "#1a1a1a", color: "#ddd", fontFamily: "monospace", letterSpacing: "0.05em",
                    }}>{urgLabels[t.urgency]}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5, paddingLeft: 14 }}>{t.action}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 28, paddingTop: 14, borderTop: "1px solid #111", fontSize: 10, color: "#333", lineHeight: 1.5, textAlign: "center" }}>
          Joseph Harari · U15566654 · Bulgarian Tax Resident · FIRE Target €625k (3.5% SWR on €22k base) · Last framework revision: April 2026
          <br/>State auto-saves. Update portfolio value monthly.
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Dashboard />);