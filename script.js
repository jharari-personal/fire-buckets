const { useState, useEffect, useMemo, useCallback, useRef } = React;
const APP_VERSION = "20260505.4";

// ─── GK CONFIGURATION ───
const GK_CONFIG = {
  IWR: 0.04,
  UPPER_GUARDRAIL: 0.032,   // Prosperity Rule: WR below this → raise 10%
  LOWER_GUARDRAIL: 0.048,   // Capital Preservation Rule: WR above this → cut 10%
  ADJUSTMENT: 0.10,
  INFLATION_CAP: 0.06,
};

// ─── UTILS ───
const getSWRTheme = (swr) => {
  if (swr <= 0) return { color: "#059669", label: "COVERED" };
  if (swr > 6.0) return { color: "#991b1b", label: "CRITICAL" };
  if (swr > 5.5) return { color: "#dc2626", label: "DANGER" };
  if (swr > GK_CONFIG.LOWER_GUARDRAIL * 100) return { color: "#dc2626", label: "CUT −10%" };
  if (swr > GK_CONFIG.IWR * 100) return { color: "#d97706", label: "ELEVATED" };
  if (swr > GK_CONFIG.UPPER_GUARDRAIL * 100) return { color: "#059669", label: "GK SAFE" };
  return { color: "#2563eb", label: "RAISE +10%" };
};

function getGKZoneStyle(wr) {
  if (wr > GK_CONFIG.LOWER_GUARDRAIL * 100) return { color: "#dc2626", label: "CUT −10%", bg: "#3a1e1e" };
  if (wr < GK_CONFIG.UPPER_GUARDRAIL * 100) return { color: "#2563eb", label: "RAISE +10%", bg: "#1e2a3a" };
  return { color: "#059669", label: "GK SAFE", bg: "#1a2e1a" };
}

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
      const t = setTimeout(() => setFlash(false), 200);
      prev.current = value;
      return () => clearTimeout(t);
    }
  }, [value]);

  if (!flash) return { transition: "all 0.8s ease-out" };

  if (type === "tab") return {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "#fff",
    textShadow: "0 0 8px #fff",
    transition: "none"
  };

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

// ─── GITHUB GIST SYNC ───
const GIST_FILENAME = "harari-state.json";

async function loadFromGist(token, gistId) {
  const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
  });
  if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${resp.statusText}`);
  const data = await resp.json();
  const content = data.files[GIST_FILENAME]?.content;
  if (!content) throw new Error("State file not found in Gist");
  return JSON.parse(content);
}

async function saveToGist(token, gistId, state) {
  const payload = {
    description: "Harari FIRE Dashboard State",
    files: { [GIST_FILENAME]: { content: JSON.stringify(state, null, 2) } },
  };
  if (gistId) {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${resp.statusText}`);
    return gistId;
  } else {
    const resp = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, public: false }),
    });
    if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${resp.statusText}`);
    const data = await resp.json();
    return data.id;
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
    id: "laid_off", label: "Sabbatical", subtitle: "No income — fortress mode",
    icon: "■", color: "#dc2626",
    buckets: {
      growth:     { target: 82, range: [78,85], floor: null,  note: "DO NOT SELL. Freeze. Let it compound." },
      fortress:   { target: 10, range: [8,12],  floor: 35000, note: "Severance lands here. Draw first." },
      termShield: { target: 5,  range: [4,7],   floor: 18000, note: "Draw second, after fortress depleted." },
      cash:       { target: 3,  range: [1,5],   floor: null,  note: "Severance overflow + operating liquidity." },
    },
  },
  lean_fire: {
    id: "lean_fire", label: "Lean FIRE", subtitle: "Part-time income + portfolio growth",
    icon: "◇", color: "#8b5cf6",
    buckets: {
      growth:     { target: 78, range: [72,82], floor: null,  note: "Multi-provider. Split VWCE / SPYI above €500k." },
      fortress:   { target: 8,  range: [6,12],  floor: 40000, note: "GK B1 approx — 2yr safety net. Draw first." },
      termShield: { target: 10, range: [8,14],  floor: 55000, note: "GK B2 partial. Rolling ladder, build toward 5yr target." },
      cash:       { target: 4,  range: [2,5],   floor: null,  note: "Operating buffer + opportunity fund." },
    },
  },
  full_fire: {
    id: "full_fire", label: "Full FIRE", subtitle: "Living off the portfolio",
    icon: "★", color: "#f59e0b",
    buckets: {
      growth:     { target: 72, range: [65,78], floor: null,   note: "Multi-provider mandatory. Rebalance annually. Never sell in drawdowns." },
      fortress:   { target: 8,  range: [6,12],  floor: 44000,  note: "GK B1 — 2yr expenses. Draw first, refill from B2." },
      termShield: { target: 16, range: [12,20], floor: 110000, note: "GK B2 — 5yr expenses. Refill B1 when depleted." },
      cash:       { target: 4,  range: [2,6],   floor: null,   note: "3–6 months immediate liquidity + opportunity." },
    },
  },
};

const BUCKET_META = {
  growth:     { label: "Growth (VWCE)",  inst: "VWCE", color: "#2563eb", short: "Compounding machine. Never sell in drawdowns." },
  fortress:   { label: "Safety (XEON)",  inst: "XEON (€STR ~2.3%)",        color: "#059669", short: "GK B1 — 2yr liquidity. Layoff runway years 0–2." },
  termShield: { label: "Fixed Income (B2)", inst: "Bonds / Bond ETF", color: "#d97706", short: "GK B2 — 5yr stability. Refill B1." },
  cash:       { label: "Cash",           inst: "EUR cash at IBKR",          color: "#6b7280", short: "DCA buffer or opportunity fund." },
};

const TRIGGERS = [
  { event: "Layoff confirmed", action: "Cancel DCA → route cash to XEON. Switch to Laid Off phase. Do NOT sell VWCE.", urgency: "immediate", category: "employment" },
  { event: "Portfolio hits €500k", action: "Split new DCA: 60% VWCE / 40% SPYI or ISAC for provider diversification.", urgency: "month", category: "milestone" },
  { event: "Portfolio hits €625k", action: "FIRE-Ready. Fortress floor → €44k (GK B1). TermShield → €110k (GK B2). Decide: keep working or transition?", urgency: "month", category: "milestone" },
  { event: "Art. 13 repealed (10% CGT)", action: "April 2026 reset is safe. Activate Beckham Law research → decide within 60 days.", urgency: "quarter", category: "tax" },
  { event: "€STR drops below 1.5%", action: "Review XEON yield. Consider short-dated EUR govt bond ETF alternative.", urgency: "quarter", category: "market" },
  { event: "March 2029 — 29GA dissolution", action: "Sell 29GA on BVME.ETF via directed limit order. Do NOT wait for December.", urgency: "immediate", category: "calendar" },
  { event: "Market drawdown > 25%", action: "Deploy strategic cash into growth. Do NOT touch fortress or term shield. GK: skip inflation raise next year.", urgency: "week", category: "market" },
  { event: "Daughter starts private school", action: "Add €10–13k/yr to expenses. Recalculate GK IWR. If > 4.8%, apply Capital Preservation cut.", urgency: "month", category: "life" },
  { event: "Wife starts earning income", action: "Reduce fortress floor by ~50% of her annual. Accelerate growth. Recalculate GK IWR.", urgency: "quarter", category: "life" },
  { event: "New employment in Spain", action: "File Beckham Law (Form 149) within 6 months of entering Spanish Social Security.", urgency: "immediate", category: "relocation" },
];

// ─── CALCULATION ENGINE ───
function calcGKNextStep({ portfolio, lastWithdrawal, annualNominalReturn, inflation }) {
  // Inflation Rule: skip raise if last year's return was negative
  let proposedWithdrawal = lastWithdrawal;
  if (annualNominalReturn >= 0) {
    const capped = Math.min(inflation, GK_CONFIG.INFLATION_CAP);
    proposedWithdrawal = lastWithdrawal * (1 + capped);
  }

  // Guardrail Rules
  const currentWR = proposedWithdrawal / portfolio;
  let trigger = null;
  let finalWithdrawal = proposedWithdrawal;

  if (currentWR > GK_CONFIG.LOWER_GUARDRAIL) {
    finalWithdrawal = proposedWithdrawal * (1 - GK_CONFIG.ADJUSTMENT);
    trigger = "CAPITAL_PRESERVATION";
  } else if (currentWR < GK_CONFIG.UPPER_GUARDRAIL) {
    finalWithdrawal = proposedWithdrawal * (1 + GK_CONFIG.ADJUSTMENT);
    trigger = "PROSPERITY";
  }

  return { proposedWithdrawal, finalWithdrawal, trigger, wr: finalWithdrawal / portfolio };
}

function runGKSimulation({ startPortfolio, startWithdrawal, nominalReturn, inflation, years = 40 }) {
  const rows = [];
  let portfolio = startPortfolio;
  let withdrawal = startWithdrawal;

  for (let year = 1; year <= years; year++) {
    const portfolioStart = portfolio;
    const step = calcGKNextStep({
      portfolio,
      lastWithdrawal: withdrawal,
      annualNominalReturn: nominalReturn,
      inflation,
    });
    const endPortfolio = Math.max(0, (portfolioStart - step.finalWithdrawal) * (1 + nominalReturn));
    rows.push({
      year,
      portfolioStart,
      proposedWithdrawal: step.proposedWithdrawal,
      trigger: step.trigger,
      finalWithdrawal: step.finalWithdrawal,
      wr: step.wr * 100,
      portfolioEnd: endPortfolio,
    });
    portfolio = endPortfolio;
    withdrawal = step.finalWithdrawal;
    if (portfolio <= 0) break;
  }
  return rows;
}

// ─── COMPONENTS ───
function Num({ children, color = "#fff", size = 20, mono = true }) {
  return <span style={{ fontSize: size, fontWeight: 700, color, fontFamily: mono ? "monospace" : "inherit", lineHeight: 1 }}>{children}</span>;
}

function SWRBadge({ swr, size = "large" }) {
  const isLg = size === "large";
  const flashStyle = useFlash(swr, "text");
  const { color, label } = getSWRTheme(swr);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isLg ? "flex-end" : "flex-start", gap: 2 }}>
      <span style={{
        fontSize: isLg ? 28 : 20,
        fontWeight: 800,
        color: flashStyle.color || color,
        fontFamily: "monospace",
        lineHeight: 1,
        transition: flashStyle.transition,
        textShadow: flashStyle.textShadow
      }}>
        {swr > 0 ? `${swr.toFixed(2)}%` : "0.00%"}
      </span>
      <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: "0.1em" }}>{label}</span>
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

function BucketRow({ bucketKey, alloc, portfolioValue, actualEur }) {
  const m = BUCKET_META[bucketKey];
  const targetEur = Math.round(portfolioValue * alloc.target / 100);
  const floorActive = alloc.floor && targetEur < alloc.floor;
  const effectiveTarget = floorActive ? alloc.floor : targetEur;

  const hasActual = actualEur !== undefined;
  const displayEur = hasActual ? actualEur : effectiveTarget;
  const fillPct = hasActual && effectiveTarget > 0
    ? Math.min(100, (actualEur / effectiveTarget) * 100)
    : alloc.target;

  const status = hasActual
    ? actualEur >= effectiveTarget ? "ON TARGET"
    : actualEur >= effectiveTarget * 0.85 ? "CLOSE"
    : "SHORT"
    : null;
  const statusColor = status === "ON TARGET" ? "#059669" : status === "CLOSE" ? "#d97706" : "#dc2626";

  const valFlash = useFlash(displayEur, "text");
  const pctFlash = useFlash(alloc.target, "text");

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ width: 4, height: 44, borderRadius: 2, background: m.color, flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>{m.label}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 11, color: valFlash.color || "#666", fontFamily: "monospace", transition: valFlash.transition, textShadow: valFlash.textShadow }}>
              €{displayEur.toLocaleString()}
              {hasActual && <span style={{ color: "#444" }}> / €{effectiveTarget.toLocaleString()}</span>}
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, color: pctFlash.color || m.color, fontFamily: "monospace", transition: pctFlash.transition, textShadow: pctFlash.textShadow }}>{alloc.target}%</span>
          </div>
        </div>
        <div style={{ width: "100%", height: 4, background: "#1a1a1a", borderRadius: 2, marginTop: 6 }}>
          <div style={{ width: `${fillPct}%`, height: "100%", background: m.color, borderRadius: 2, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#666" }}>{alloc.note}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {floorActive && <span style={{ fontSize: 10, color: "#f87171", fontWeight: 700, fontFamily: "monospace" }}>FLOOR OVERRIDE</span>}
            {status && <span style={{ fontSize: 10, color: statusColor, fontWeight: 700, fontFamily: "monospace" }}>{status}</span>}
          </div>
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

  const [bucketVWCE,  setBucketVWCE]  = useState(394800);
  const [bucketXEON,  setBucketXEON]  = useState(32900);
  const [bucketFixed, setBucketFixed] = useState(23500);
  const [bucketCash,  setBucketCash]  = useState(18800);
  const [phase, setPhase] = useState("employed");

  // Operating Levers
  const [mainIncome, setMainIncome] = useState(6000);
  const [annualExpense, setAnnualExpense] = useState(20000);
  const [wifeIncome, setWifeIncome] = useState(0);
  const [schoolCost, setSchoolCost] = useState(0);
  const [antiAtrophy, setAntiAtrophy] = useState(5000);
  const [travelBudget, setTravelBudget] = useState(4000);
  const [resortFees, setResortFees] = useState(1000);

  // Capital Levers
  const [buildCost, setBuildCost] = useState(250000);
  const [apartmentRent, setApartmentRent] = useState(10800);
  const [resortCost, setResortCost] = useState(100000);

  const [bgTax10, setBgTax10] = useState(false);
  const [realReturn, setRealReturn] = useState(5);
  const [showTriggers, setShowTriggers] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("runway");

  // ─── GIST SYNC STATE ───
  const [ghToken, setGhToken]           = useState("");
  const [gistId, setGistId]             = useState("");
  const [syncStatus, setSyncStatus]     = useState("local"); // local | loading | ok | error
  const [syncError, setSyncError]       = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [tokenInput, setTokenInput]     = useState("");

  // ─── SITUATION FLAGS ───
  const [flags, setFlags] = useState({
    employed:        true,
    extraIncome:     false,
    apartmentRental: false,
    funBudget:       true,
    travelBudget:    false,
    privateSchool:   false,
    asenovgrad:      false,
    resort:          false,
    valencia:        false,
  });
  const toggleFlag = useCallback((key) => setFlags(f => ({ ...f, [key]: !f[key] })), []);

  // ─── GK STATE ───
  const [gkBaseWithdrawal, setGkBaseWithdrawal] = useState(0);
  const [gkNominalReturn, setGkNominalReturn] = useState(7.5);
  const [gkInflation, setGkInflation] = useState(2.5);
  const [gkHistory, setGkHistory] = useState([]);
  const [gkLastReturn, setGkLastReturn] = useState(7.5);
  const [gkThisInflation, setGkThisInflation] = useState(2.5);
  const [showAddGKEntry, setShowAddGKEntry] = useState(false);
  const [gkEntryYear, setGkEntryYear] = useState(String(new Date().getFullYear()));
  const [gkEntryPortfolioStart, setGkEntryPortfolioStart] = useState(0);
  const [gkEntryReturn, setGkEntryReturn] = useState(7.5);
  const [gkEntryInflation, setGkEntryInflation] = useState(2.5);
  // Separate portfolio value for the "This Year's Check" panel — lets user enter
  // their actual current balance without disturbing the main portfolio slider.
  // 0 = not yet set, will be initialised to main portfolio on first use.
  const [gkCheckPortfolio, setGkCheckPortfolio] = useState(0);

  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    (async () => {
      // Load Gist credentials from their own localStorage keys
      const savedToken = localStorage.getItem("harari-gh-token") || "";
      const savedGistId = localStorage.getItem("harari-gist-id") || "";
      if (savedToken) { setGhToken(savedToken); setTokenInput(savedToken); }
      if (savedGistId) setGistId(savedGistId);

      // Try Gist first, fall back to localStorage
      let s = null;
      if (savedToken && savedGistId) {
        setSyncStatus("loading");
        try {
          s = await loadFromGist(savedToken, savedGistId);
          setSyncStatus("ok");
        } catch (e) {
          setSyncError(e.message);
          setSyncStatus("error");
          s = await loadState();
        }
      } else {
        s = await loadState();
      }

      if (s) {
        if (s.bucketVWCE !== undefined) {
          setBucketVWCE(s.bucketVWCE);
          setBucketXEON(s.bucketXEON);
          setBucketFixed(s.bucketFixed);
          setBucketCash(s.bucketCash);
        } else if (s.portfolio) {
          // Migrate single portfolio value → split by saved phase targets
          const pd = PHASES[s.phase || "employed"];
          const t = s.portfolio;
          const v = Math.round(t * pd.buckets.growth.target / 100);
          const x = Math.round(t * pd.buckets.fortress.target / 100);
          const f = Math.round(t * pd.buckets.termShield.target / 100);
          setBucketVWCE(v);
          setBucketXEON(x);
          setBucketFixed(f);
          setBucketCash(t - v - x - f);
        }
        if (s.phase) setPhase(s.phase);
        if (s.mainIncome !== undefined) setMainIncome(s.mainIncome);
        else if (s.monthlyContrib !== undefined) setMainIncome(s.monthlyContrib);
        if (s.annualExpense) setAnnualExpense(s.annualExpense);
        if (s.wifeIncome !== undefined) setWifeIncome(s.wifeIncome);
        if (s.schoolCost !== undefined) setSchoolCost(s.schoolCost);
        if (s.antiAtrophy !== undefined) setAntiAtrophy(s.antiAtrophy);
        if (s.travelBudget !== undefined) setTravelBudget(s.travelBudget);
        if (s.resortFees !== undefined) setResortFees(s.resortFees);
        if (s.buildCost !== undefined) setBuildCost(s.buildCost);
        if (s.apartmentRent !== undefined) setApartmentRent(s.apartmentRent);
        if (s.resortCost !== undefined) setResortCost(s.resortCost);
        if (s.bgTax10 !== undefined) setBgTax10(s.bgTax10);
        if (s.realReturn !== undefined) setRealReturn(s.realReturn);
        if (s.flags) setFlags(f => ({ ...f, ...s.flags }));
        if (s.gkBaseWithdrawal !== undefined) setGkBaseWithdrawal(s.gkBaseWithdrawal);
        if (s.gkNominalReturn !== undefined) setGkNominalReturn(s.gkNominalReturn);
        if (s.gkInflation !== undefined) setGkInflation(s.gkInflation);
        if (s.gkHistory) setGkHistory(s.gkHistory);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const state = {
      bucketVWCE, bucketXEON, bucketFixed, bucketCash,
      phase, mainIncome, annualExpense, wifeIncome,
      schoolCost, antiAtrophy, travelBudget, resortFees, buildCost,
      apartmentRent, resortCost, bgTax10, realReturn, flags,
      gkBaseWithdrawal, gkNominalReturn, gkInflation, gkHistory,
    };
    const t = setTimeout(async () => {
      saveState(state); // localStorage backup always
      if (ghToken) {
        setSyncStatus("syncing");
        try {
          const newId = await saveToGist(ghToken, gistId, state);
          if (newId !== gistId) {
            setGistId(newId);
            localStorage.setItem("harari-gist-id", newId);
          }
          setSyncStatus("ok");
          setSyncError("");
        } catch (e) {
          setSyncError(e.message);
          setSyncStatus("error");
        }
      }
    }, 500);
    return () => clearTimeout(t);
  }, [loaded, bucketVWCE, bucketXEON, bucketFixed, bucketCash, phase, mainIncome, annualExpense, wifeIncome, schoolCost, antiAtrophy, travelBudget, resortFees, buildCost, apartmentRent, resortCost, bgTax10, realReturn, flags, gkBaseWithdrawal, gkNominalReturn, gkInflation, gkHistory, ghToken, gistId]);

  const portfolio = bucketVWCE + bucketXEON + bucketFixed + bucketCash;

  const phaseData = PHASES[phase];
  const bucketKeys = ["growth", "fortress", "termShield", "cash"];

  // ─── EFFECTIVE VALUES ───
  const effectiveApartmentRent  = flags.apartmentRental ? apartmentRent   : 0;
  const effectiveAntiAtrophy    = flags.funBudget       ? antiAtrophy     : 0;
  const effectiveTravelBudget   = flags.travelBudget    ? travelBudget    : 0;
  const effectiveSchoolCost     = flags.privateSchool   ? schoolCost      : 0;

  // ─── OPTION MATRICES ───
  const plovGross = annualExpense + effectiveAntiAtrophy + effectiveSchoolCost;

  const effectiveMainIncome     = flags.employed    ? mainIncome  : 0;
  const totalMonthlyIncome      = effectiveMainIncome + (flags.extraIncome ? wifeIncome : 0);
  const netMonthlyCashflow      = totalMonthlyIncome - plovGross / 12;
  const effectiveMonthlyContrib = Math.max(0, netMonthlyCashflow);
  const calcDrawWithTax = (grossExpense, additionalIncome = 0) => {
    const netDraw = Math.max(0, grossExpense - additionalIncome);
    const taxDrag = bgTax10 ? netDraw * 0.5 * 0.10 : 0;
    return netDraw + taxDrag;
  };

  const plovTotal = calcDrawWithTax(plovGross);
  const plovSWR = portfolio > 0 ? (plovTotal / portfolio) * 100 : 0;

  const netApartmentRent = effectiveApartmentRent * 0.91;

  const buildCapital = portfolio - buildCost;
  const buildNetDraw = calcDrawWithTax(plovGross, netApartmentRent);
  const buildSWR = buildCapital > 0 ? (buildNetDraw / buildCapital) * 100 : 0;

  const resortCapital = portfolio - resortCost;
  const resortNetDraw = calcDrawWithTax(plovGross + resortFees);
  const resortSWR = resortCapital > 0 ? (resortNetDraw / resortCapital) * 100 : 0;

  const travelNetDraw = calcDrawWithTax(plovGross + effectiveTravelBudget);
  const travelSWR = portfolio > 0 ? (travelNetDraw / portfolio) * 100 : 0;

  const valBase = 36000;
  const valTotal = Math.max(0, valBase + effectiveSchoolCost - netApartmentRent);
  const valSWR = portfolio > 0 ? (valTotal / portfolio) * 100 : 0;

  // Runway
  const fortressEur = Math.max(phaseData.buckets.fortress.floor || 0, Math.round(portfolio * phaseData.buckets.fortress.target / 100));
  const termEur = Math.max(phaseData.buckets.termShield.floor || 0, Math.round(portfolio * phaseData.buckets.termShield.target / 100));
  const cashEur = Math.round(portfolio * phaseData.buckets.cash.target / 100);
  const monthlyBurn = plovTotal / 12;
  const runwayMonths = monthlyBurn > 0 ? Math.round((fortressEur + termEur + cashEur) / monthlyBurn) : 999;

  const monthsTo = useCallback((target) => {
    if (portfolio >= target) return null;
    const r = realReturn / 100 / 12;
    const c = effectiveMonthlyContrib;
    for (let n = 1; n <= 360; n++) {
      const fv = portfolio * Math.pow(1 + r, n) + c * (Math.pow(1 + r, n) - 1) / (r || 0.0001);
      if (fv >= target) return n;
    }
    return 360;
  }, [portfolio, realReturn, effectiveMonthlyContrib]);

  const projections = useMemo(() => ({
    p500: monthsTo(500000),
    aggressive: monthsTo(FIRE_TARGETS.aggressive),
    recommended: monthsTo(FIRE_TARGETS.recommended),
    bulletproof: monthsTo(FIRE_TARGETS.bulletproof),
  }), [monthsTo]);

  const fireGap = Math.max(0, FIRE_TARGETS.recommended - portfolio);
  const fireProgress = Math.min(100, (portfolio / FIRE_TARGETS.recommended) * 100);

  // ─── GK DERIVED STATE ───
  const effectiveBaseWithdrawal = gkBaseWithdrawal > 0 ? gkBaseWithdrawal : plovTotal;
  const currentGKWR = portfolio > 0 ? (effectiveBaseWithdrawal / portfolio) * 100 : 0;

  // ─── INCOME ALLOCATION ───
  const incomeWR = currentGKWR / 100;
  const incomeSurplusInvestPct =
    incomeWR < 0.032 ? 0.50 :
    incomeWR < 0.040 ? 0.65 :
    incomeWR < 0.048 ? 0.80 : 0.90;
  const incomeInvestPct =
    phase === 'employed' ? Math.min(incomeSurplusInvestPct + 0.10, 0.95) :
    phase === 'laid_off' ? Math.min(incomeSurplusInvestPct + 0.05, 0.92) :
    incomeSurplusInvestPct;
  const incomeToInvest = netMonthlyCashflow > 0
    ? Math.round(netMonthlyCashflow * incomeInvestPct / 10) * 10 : 0;
  const incomeToSpend = netMonthlyCashflow > 0 ? netMonthlyCashflow - incomeToInvest : 0;
  const incomeTargetVWCE  = Math.max(phaseData.buckets.growth.floor     || 0, Math.round(portfolio * phaseData.buckets.growth.target     / 100));
  const incomeTargetXEON  = Math.max(phaseData.buckets.fortress.floor   || 0, Math.round(portfolio * phaseData.buckets.fortress.target   / 100));
  const incomeTargetFixed = Math.max(phaseData.buckets.termShield.floor || 0, Math.round(portfolio * phaseData.buckets.termShield.target / 100));
  const incomeBucketOptions = [
    { name: "VWCE (Growth B3)",      shortfall: Math.max(0, incomeTargetVWCE  - bucketVWCE),  target: incomeTargetVWCE  },
    { name: "XEON (Fortress B1)",    shortfall: Math.max(0, incomeTargetXEON  - bucketXEON),  target: incomeTargetXEON  },
    { name: "Fixed Income (B2)",     shortfall: Math.max(0, incomeTargetFixed - bucketFixed), target: incomeTargetFixed },
  ];
  const incomeMostShort = incomeBucketOptions.reduce((a, b) =>
    (b.target > 0 ? b.shortfall / b.target : 0) > (a.target > 0 ? a.shortfall / a.target : 0) ? b : a
  );
  const incomeBucketRec = incomeMostShort.shortfall > 0
    ? { name: incomeMostShort.name, reason: `€${Math.round(incomeMostShort.shortfall).toLocaleString()} below target` }
    : { name: "VWCE (Growth B3)", reason: "all buckets on target — keep compounding" };

  // Use independent portfolio value for the check panel so return magnitude is meaningful
  const checkPortfolio = gkCheckPortfolio > 0 ? gkCheckPortfolio : portfolio;
  const currentYearGK = useMemo(() => calcGKNextStep({
    portfolio: checkPortfolio,
    lastWithdrawal: effectiveBaseWithdrawal,
    annualNominalReturn: gkLastReturn / 100,
    inflation: gkThisInflation / 100,
  }), [checkPortfolio, effectiveBaseWithdrawal, gkLastReturn, gkThisInflation]);

  const simRows = useMemo(() => runGKSimulation({
    startPortfolio: portfolio,
    startWithdrawal: effectiveBaseWithdrawal,
    nominalReturn: gkNominalReturn / 100,
    inflation: gkInflation / 100,
    years: 40,
  }), [portfolio, effectiveBaseWithdrawal, gkNominalReturn, gkInflation]);

  // Last history entry's withdrawal (for add-entry calc)
  const lastHistoryWithdrawal = gkHistory.length > 0
    ? gkHistory[gkHistory.length - 1].finalWithdrawal
    : effectiveBaseWithdrawal;

  const addGKHistoryEntry = () => {
    const gk = calcGKNextStep({
      portfolio: gkEntryPortfolioStart,
      lastWithdrawal: lastHistoryWithdrawal,
      annualNominalReturn: gkEntryReturn / 100,
      inflation: gkEntryInflation / 100,
    });
    const entry = {
      id: Date.now(),
      yearLabel: gkEntryYear,
      portfolioStart: gkEntryPortfolioStart,
      actualReturn: gkEntryReturn,
      actualInflation: gkEntryInflation,
      lastWithdrawal: lastHistoryWithdrawal,
      proposedWithdrawal: gk.proposedWithdrawal,
      trigger: gk.trigger,
      finalWithdrawal: gk.finalWithdrawal,
      wr: gk.wr * 100,
      portfolioEnd: Math.max(0, (gkEntryPortfolioStart - gk.finalWithdrawal) * (1 + gkEntryReturn / 100)),
    };
    const newHistory = [...gkHistory, entry];
    setGkHistory(newHistory);
    setGkBaseWithdrawal(Math.round(gk.finalWithdrawal));
    setShowAddGKEntry(false);
    setGkEntryYear(String(parseInt(gkEntryYear) + 1));
    setGkEntryPortfolioStart(Math.round(entry.portfolioEnd));
  };

  // ─── FLASH HOOKS ───
  const portFlash = useFlash(portfolio, "text");
  const gapFlash = useFlash(fireGap, "text");
  const runFlash = useFlash(runwayMonths, "text");
  const swrFlash = useFlash(plovSWR, "text");
  const pctFlash = useFlash(fireProgress, "text");
  const mosFlash = useFlash(projections.recommended, "text");

  const runHash = `${phase}-${portfolio}-${annualExpense}-${antiAtrophy}-${schoolCost}-${wifeIncome}-${buildCost}-${resortCost}-${travelBudget}-${resortFees}-${bgTax10}-${apartmentRent}`;
  const allocHash = `${phase}-${portfolio}`;
  const projHash = `${portfolio}-${mainIncome}-${wifeIncome}-${realReturn}`;
  const gkHash = `${portfolio}-${Math.round(effectiveBaseWithdrawal)}-${gkNominalReturn}-${gkInflation}`;

  const runTabFlash = useFlash(runHash, "tab");
  const allocTabFlash = useFlash(allocHash, "tab");
  const projTabFlash = useFlash(projHash, "tab");
  const gkTabFlash = useFlash(gkHash, "tab");

  // ─── GIST CONNECT HANDLER ───
  const handleConnectGist = async () => {
    const token = tokenInput.trim();
    if (!token) {
      // Disconnect
      localStorage.removeItem("harari-gh-token");
      localStorage.removeItem("harari-gist-id");
      setGhToken(""); setGistId(""); setSyncStatus("local"); setSyncError("");
      return;
    }
    localStorage.setItem("harari-gh-token", token);
    setGhToken(token);
    setSyncStatus("syncing");
    try {
      const state = {
        bucketVWCE, bucketXEON, bucketFixed, bucketCash,
        phase, mainIncome, annualExpense, wifeIncome,
        schoolCost, antiAtrophy, travelBudget, resortFees, buildCost,
        apartmentRent, resortCost, bgTax10, realReturn, flags,
        gkBaseWithdrawal, gkNominalReturn, gkInflation, gkHistory,
      };
      const newId = await saveToGist(token, gistId, state);
      setGistId(newId);
      localStorage.setItem("harari-gist-id", newId);
      setSyncStatus("ok"); setSyncError("");
    } catch (e) {
      setSyncError(e.message); setSyncStatus("error");
    }
  };

  const syncDot = { ok: "#22c55e", syncing: "#f59e0b", error: "#dc2626", loading: "#f59e0b", local: "#444" }[syncStatus];
  const syncLabel = { ok: "Synced", syncing: "Saving…", error: "Sync error", loading: "Loading…", local: "Local only" }[syncStatus];

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
            State auto-saves locally. Click the sync indicator to connect GitHub Gist for cross-device sync.
          </p>
        </div>

        {deferredPrompt && (
          <button onClick={handleInstallClick} style={{
            width: "100%", padding: 12, background: "#059669", color: "#fff",
            border: "none", borderRadius: 8, marginBottom: 20, fontWeight: 700, cursor: "pointer",
            fontFamily: "inherit"
          }}>
            Install App to Home Screen
          </button>
        )}

        {/* TOP STRIP METRICS */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Portfolio", value: `€${(portfolio/1000).toFixed(0)}k`, color: "#fff", f: portFlash },
            { label: "FIRE Gap", value: fireGap > 0 ? `€${(fireGap/1000).toFixed(0)}k` : "DONE", color: fireGap > 0 ? "#f59e0b" : "#059669", f: gapFlash },
            { label: "Runway", value: `${runwayMonths} mo`, color: runwayMonths > 36 ? "#059669" : runwayMonths > 18 ? "#d97706" : "#dc2626", f: runFlash },
            { label: "GK IWR", value: `${currentGKWR.toFixed(1)}%`, color: getGKZoneStyle(currentGKWR).color, f: swrFlash },
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
              const pos = (t / 625) * 100;
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

        {/* ACTIVE SITUATION FLAGS */}
        <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 8, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 10 }}>
            Active Situation — toggle to show/hide relevant sliders and scenarios
          </div>
          {[
            { label: "Income",    color: "#2563eb", items: [
              { key: "employed",        label: "Employed"      },
              { key: "extraIncome",     label: "Extra Income"  },
              { key: "apartmentRental", label: "Apt Rental"    },
            ]},
            { label: "Spending",  color: "#ef4444", items: [
              { key: "funBudget",     label: "Fun Budget"      },
              { key: "travelBudget",  label: "Travel"          },
              { key: "privateSchool", label: "Private School"  },
            ]},
            { label: "Scenarios", color: "#8b5cf6", items: [
              { key: "asenovgrad", label: "Asenovgrad Build" },
              { key: "resort",     label: "Resort Apt"      },
              { key: "valencia",   label: "Valencia"        },
            ]},
          ].map(({ label, color, items }) => (
            <div key={label} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", width: 58, flexShrink: 0 }}>{label}</span>
              {items.map(({ key, label: lbl }) => {
                const on = flags[key];
                return (
                  <button key={key} onClick={() => toggleFlag(key)} style={{
                    padding: "4px 11px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                    border: on ? `1px solid ${color}60` : "1px solid #1e1e1e",
                    background: on ? `${color}1a` : "transparent",
                    color: on ? "#ccc" : "#444",
                    fontSize: 11, fontWeight: on ? 600 : 400,
                    transition: "all 0.12s",
                  }}>
                    <span style={{ fontSize: 8, marginRight: 5, opacity: on ? 1 : 0.3 }}>{on ? "●" : "○"}</span>{lbl}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* TAB SWITCHER */}
        <div style={{
          display: "flex", gap: 0, marginBottom: 0, borderBottom: "1px solid #222",
          overflowX: "auto", whiteSpace: "nowrap", WebkitOverflowScrolling: "touch",
          alignItems: "flex-end",
        }}>
          {[
            { key: "runway",      label: "Runway & Levers", flashStyle: runTabFlash },
            { key: "allocator",   label: "Allocation",      flashStyle: allocTabFlash },
            { key: "projection",  label: "Projection",      flashStyle: projTabFlash },
            { key: "withdrawals", label: "Withdrawals",     flashStyle: gkTabFlash },
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
            );
          })}
          {/* Sync indicator — pushes to right */}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowSettings(s => !s)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "8px 12px",
            border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit",
            color: "#444", fontSize: 11, borderBottom: showSettings ? "2px solid #555" : "2px solid transparent",
            flexShrink: 0,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: syncDot, flexShrink: 0 }} />
            {!isMobile && <span>{syncLabel}</span>}
          </button>
        </div>

        {/* SETTINGS PANEL */}
        {showSettings && (
          <div style={{ padding: "16px", background: "#111", border: "1px solid #222", borderTop: "none", borderRadius: "0 0 8px 8px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Cloud Sync — GitHub Gist</div>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 12, lineHeight: 1.6 }}>
              State syncs to a private GitHub Gist so it persists across devices and browsers.
              Create a <strong style={{ color: "#888" }}>fine-grained personal access token</strong> at{" "}
              <span style={{ color: "#3b82f6", fontFamily: "monospace" }}>github.com/settings/tokens</span> with{" "}
              <strong style={{ color: "#888" }}>Gists: read &amp; write</strong> permission.
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="github_pat_…"
                style={{
                  flex: 1, padding: "8px 10px", background: "#0d0d0d", border: "1px solid #333",
                  borderRadius: 6, color: "#ddd", fontSize: 12, fontFamily: "monospace",
                  outline: "none",
                }}
              />
              <button onClick={handleConnectGist} style={{
                padding: "8px 16px", background: tokenInput.trim() ? "#2563eb" : "#222",
                border: "none", borderRadius: 6, color: "#fff", fontSize: 12,
                fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
                {ghToken ? "Update" : "Connect"}
              </button>
              {ghToken && (
                <button onClick={() => { setTokenInput(""); handleConnectGist(); }} style={{
                  padding: "8px 12px", background: "transparent", border: "1px solid #333",
                  borderRadius: 6, color: "#666", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>Disconnect</button>
              )}
            </div>
            {gistId && (
              <div style={{ fontSize: 10, color: "#444", fontFamily: "monospace" }}>
                Gist: <a href={`https://gist.github.com/${gistId}`} target="_blank" rel="noreferrer"
                  style={{ color: "#3b82f6" }}>{gistId}</a>
              </div>
            )}
            {syncStatus === "error" && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#f87171" }}>Error: {syncError}</div>
            )}
          </div>
        )}
        {showSettings ? null : <div style={{ marginBottom: 20 }} />}

        {/* TAB: RUNWAY & LEVERS */}
        {tab === "runway" && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 28 }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card highlight>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Capital Levers</h3>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #222" }}>
                  <span style={{ fontSize: 11, color: "#888" }}>Total IBKR Portfolio</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>€{portfolio.toLocaleString()}</span>
                </div>
                <Slider label="VWCE (Growth B3)" value={bucketVWCE} onChange={setBucketVWCE} min={0} max={800000} step={1000} color="#2563eb" format={v => `€${v.toLocaleString()}`} />
                <Slider label="XEON (Fortress B1)" value={bucketXEON} onChange={setBucketXEON} min={0} max={150000} step={500} color="#059669" format={v => `€${v.toLocaleString()}`} />
                <Slider label="Fixed Income (B2)" value={bucketFixed} onChange={setBucketFixed} min={0} max={250000} step={500} color="#d97706" format={v => `€${v.toLocaleString()}`} />
                <Slider label="EUR Cash" value={bucketCash} onChange={setBucketCash} min={0} max={80000} step={500} color="#6b7280" format={v => `€${v.toLocaleString()}`} />
                {flags.apartmentRental && <Slider label="Plovdiv Apt Rental Yield" value={apartmentRent} onChange={setApartmentRent} min={0} max={25000} step={600} color="#10b981" format={v => `€${v.toLocaleString()}`} suffix="/yr" />}
                {(flags.asenovgrad || flags.resort) && <div style={{ height: 1, background: "#222", margin: "16px 0" }} />}
                {flags.asenovgrad      && <Slider label="Asenovgrad Build Cost" value={buildCost} onChange={setBuildCost} min={150000} max={400000} step={10000} color="#f59e0b" format={v => `€${v.toLocaleString()}`} />}
                {flags.resort          && <Slider label="Resort Apartment Cost" value={resortCost} onChange={setResortCost} min={50000} max={200000} step={5000} color="#f59e0b" format={v => `€${v.toLocaleString()}`} />}
              </Card>

              <Card highlight>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Expense Levers</h3>
                <Slider label="Regular Budget" value={annualExpense} onChange={setAnnualExpense} min={15000} max={35000} step={1000} color="#ef4444" format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                {flags.funBudget      && <Slider label="Extra Fun Budget" value={antiAtrophy} onChange={setAntiAtrophy} min={0} max={15000} step={500} color="#8b5cf6" format={v => `€${v.toLocaleString()}`} suffix="/yr" />}
                {flags.travelBudget   && <Slider label="Extra Travel Budget" value={travelBudget} onChange={setTravelBudget} min={0} max={15000} step={500} color="#ec4899" format={v => `€${v.toLocaleString()}`} suffix="/yr" />}
                {flags.resort         && <Slider label="Second Home Maintenance" value={resortFees} onChange={setResortFees} min={0} max={3000} step={100} color="#d97706" format={v => `€${v.toLocaleString()}`} suffix="/yr" />}
                {flags.privateSchool  && <Slider label="Private School Cost" value={schoolCost} onChange={setSchoolCost} min={0} max={15000} step={1000} color="#10b981" format={v => `€${v.toLocaleString()}`} suffix="/yr" />}
                {flags.funBudget && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, borderLeft: "3px solid #8b5cf6" }}>
                    <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
                      <strong style={{ color: "#ccc" }}>Fun Budget:</strong> Clothes, Entertainment, Hobbies, Beauty, etc
                    </div>
                  </div>
                )}
                {flags.travelBudget && (
                  <div style={{ marginTop: 8, padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, borderLeft: "3px solid #ec4899" }}>
                    <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
                      <strong style={{ color: "#ccc" }}>Travel Budget:</strong> Additional travelling budget, on top of the regular budget.
                    </div>
                  </div>
                )}
              </Card>

              {(flags.employed || flags.extraIncome) && (
                <Card highlight>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>Income &amp; Cash Flow This Month</h3>
                  {flags.employed && (
                    <Slider label="Monthly Salary" value={mainIncome} onChange={setMainIncome} min={0} max={10000} step={100} color="#2563eb" format={v => `€${v.toLocaleString()}`} suffix="/mo" />
                  )}
                  {flags.extraIncome && (
                    <Slider label="Side Income This Month" value={wifeIncome} onChange={setWifeIncome} min={0} max={3000} step={50} color="#b80aed" format={v => `€${v}`} suffix="/mo" />
                  )}
                  {flags.employed && flags.extraIncome && totalMonthlyIncome > 0 && (
                    <div style={{ marginTop: 6, marginBottom: 4, fontSize: 10, color: "#555" }}>
                      Salary €{mainIncome.toLocaleString()} + side €{wifeIncome.toLocaleString()} = €{totalMonthlyIncome.toLocaleString()}/mo total
                    </div>
                  )}
                  {totalMonthlyIncome === 0 ? (
                    <div style={{ marginTop: 12, padding: "10px 12px", background: "#0d0d0d", borderRadius: 6, border: "1px solid #222" }}>
                      <div style={{ fontSize: 11, color: "#555" }}>Enter income above to see how to allocate it.</div>
                    </div>
                  ) : netMonthlyCashflow < 0 ? (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ padding: "10px 12px", background: "#2d1515", borderRadius: 6, borderLeft: "3px solid #dc2626" }}>
                        <div style={{ fontSize: 12, color: "#fca5a5" }}>Need from portfolio: <strong>€{Math.round(Math.abs(netMonthlyCashflow)).toLocaleString()}/mo</strong></div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#0d0d0d", borderRadius: 6, borderLeft: "3px solid #555" }}>
                        <div style={{ fontSize: 11, color: "#666" }}>
                          Expenses €{Math.round(plovGross / 12).toLocaleString()}/mo · Income €{Math.round(totalMonthlyIncome).toLocaleString()}/mo
                        </div>
                      </div>
                      <div style={{ padding: "8px 12px", background: "#0d0d0d", borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: "#555" }}>
                          {getGKZoneStyle(incomeWR * 100).label} (WR {(incomeWR * 100).toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ padding: "10px 12px", background: "#052e16", borderRadius: 6, borderLeft: "3px solid #22c55e" }}>
                        <div style={{ fontSize: 12, color: "#86efac" }}>Expenses covered ✓ <span style={{ color: "#4ade80", fontWeight: 600 }}>€{Math.round(plovGross / 12).toLocaleString()}/mo</span></div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#0c1a2e", borderRadius: 6, borderLeft: "3px solid #3b82f6" }}>
                        <div style={{ fontSize: 12, color: "#93c5fd" }}>Transfer to IBKR: <strong>€{incomeToInvest.toLocaleString()}</strong></div>
                        <div style={{ fontSize: 10, color: "#4a7ab5", marginTop: 3 }}>→ {incomeBucketRec.name} ({incomeBucketRec.reason}) · then update portfolio above</div>
                      </div>
                      <div style={{ padding: "10px 12px", background: "#160b22", borderRadius: 6, borderLeft: "3px solid #b80aed" }}>
                        <div style={{ fontSize: 12, color: "#d8b4fe" }}>Spend freely: <strong>€{incomeToSpend.toLocaleString()}</strong></div>
                      </div>
                      <div style={{ padding: "8px 12px", background: "#0d0d0d", borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: "#555" }}>
                          {getGKZoneStyle(incomeWR * 100).label} (WR {(incomeWR * 100).toFixed(1)}%) — {Math.round(incomeInvestPct * 100)}% of surplus to portfolio
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )}
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

                <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: `1px solid ${getSWRTheme(plovSWR).color}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>1. Plovdiv Retirement</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Net draw: €{plovTotal.toLocaleString()}/yr</div>
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>Zero capital risk. Optimal financially, but fails social and stimulation constraints without heavy anti-atrophy spend.</div>
                    </div>
                    <SWRBadge swr={plovSWR} size="small" />
                  </div>
                </div>

                {flags.valencia && (
                  <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: `1px solid ${getSWRTheme(valSWR).color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>2. Valencia Relocation</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Net draw: €{valTotal.toLocaleString()}/yr <span style={{ color: "#2563eb", fontWeight: 700 }}>Beckham Law</span></div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>The structural endgame. Requires qualifying Spanish contract first to shield equity portfolio.</div>
                      </div>
                      <SWRBadge swr={valSWR} size="small" />
                    </div>
                  </div>
                )}

                {flags.asenovgrad && (
                  <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: `1px solid ${getSWRTheme(buildSWR).color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>3. Asenovgrad Build</div>
                        <div style={{ fontSize: 11, color: buildCapital < 200000 ? "#fca5a5" : "#888", marginTop: 4, fontWeight: buildCapital < 200000 ? 700 : 400 }}>
                          Liquid Base: €{Math.max(0, buildCapital).toLocaleString()} {buildCapital < 200000 && "(DANGEROUS FRAGILITY)"}
                        </div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>
                          Net draw: €{buildNetDraw.toLocaleString()}/yr. SWR ignores execution stress, budget overruns, and 100% occupancy risk.
                        </div>
                      </div>
                      <SWRBadge swr={buildSWR} size="small" />
                    </div>
                  </div>
                )}

                {flags.resort && (
                  <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: `1px solid ${getSWRTheme(resortSWR).color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>4. Resort Apartment</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Capital Base: €{Math.max(0, resortCapital).toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>High logistical friction (packing/driving). Off-season boredom (Pamporovo) or toxic smog (Velingrad).</div>
                      </div>
                      <SWRBadge swr={resortSWR} size="small" />
                    </div>
                  </div>
                )}

                {flags.travelBudget && (
                  <div style={{ background: "#0a0a0a", borderRadius: 8, padding: 14, border: `1px solid ${getSWRTheme(travelSWR).color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>5. Flexible Travel</div>
                        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>Net draw: €{travelNetDraw.toLocaleString()}/yr</div>
                        <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.4 }}>Financially optimal. High chaos and transient lifestyle. Fails to build permanent local community.</div>
                      </div>
                      <SWRBadge swr={travelSWR} size="small" />
                    </div>
                  </div>
                )}

              </div>

              <div style={{ marginTop: 12, padding: "8px 10px", background: "#111", borderRadius: 6, fontSize: 10, color: "#555", fontFamily: "monospace" }}>
                GK guardrails: <span style={{ color: "#2563eb" }}>3.2%</span> raise · <span style={{ color: "#059669" }}>3.2–4.0% safe</span> · <span style={{ color: "#d97706" }}>4.0–4.8% elevated</span> · <span style={{ color: "#dc2626" }}>4.8%+ cut</span>
              </div>

              <div style={{ marginTop: 10, padding: "10px 12px", background: "#1a1a1a", borderRadius: 6, fontSize: 11, color: "#888", lineHeight: 1.6 }}>
                <strong>Recommendation: The Sequenced Hybrid.</strong> Optimize Plovdiv status quo with targeted premium anti-atrophy spend during the income gap. Trigger Valencia relocation <em>only</em> upon securing an employment contract to activate the Beckham Law shield.
              </div>
            </Card>
          </div>
        )}

        {/* TAB: ALLOCATOR */}
        {tab === "allocator" && (
          <div style={{ marginBottom: 28 }}>

            {/* PHASE SELECTOR */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 10 }}>
                Life Phase — sets bucket allocation targets and floor amounts
              </div>
              <div style={{ display: "flex", gap: isMobile ? 8 : 6, flexWrap: "wrap" }}>
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
              <div style={{ marginTop: 8, fontSize: 11, color: "#555" }}>
                {phaseData.subtitle}
              </div>
            </div>

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
              {bucketKeys.map(k => {
                const actualMap = { growth: bucketVWCE, fortress: bucketXEON, termShield: bucketFixed, cash: bucketCash };
                return <BucketRow key={k} bucketKey={k} alloc={phaseData.buckets[k]} portfolioValue={portfolio} actualEur={actualMap[k]} />;
              })}
            </Card>

            {/* GK BUCKET TARGETS — shown for decumulation phases */}
            {(phase === "full_fire" || phase === "lean_fire") && (() => {
              const b1Target = Math.round(plovTotal * 2);
              const b2Target = Math.round(plovTotal * 5);
              const b3Target = Math.max(0, portfolio - b1Target - b2Target);
              const b1Current = fortressEur;
              const b2Current = termEur;
              const b3Current = Math.round(portfolio * phaseData.buckets.growth.target / 100);
              const satelliteCap = Math.round(portfolio * 0.10);

              const buckets = [
                { label: "B1 — Safety (XEON)", color: "#059669", target: b1Target, current: b1Current, desc: "2yr expenses — draw first, never touch Growth" },
                { label: "B2 — Stability (29GA/Bonds)", color: "#d97706", target: b2Target, current: b2Current, desc: "5yr expenses — refill B1 when depleted" },
                { label: "B3 — Growth (VWCE)", color: "#2563eb", target: b3Target, current: b3Current, desc: "Everything else — never sell in drawdowns" },
              ];

              return (
                <Card style={{ marginTop: 12, borderLeft: "3px solid #8b5cf6" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
                    GK 3-Bucket Targets — {phaseData.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#555", marginBottom: 12 }}>
                    Based on annual draw of €{Math.round(plovTotal).toLocaleString()}/yr · IWR {plovSWR.toFixed(2)}%
                  </div>
                  {buckets.map(b => {
                    const diff = b.current - b.target;
                    const tol = b.target * 0.05;
                    const onTarget = Math.abs(diff) < tol;
                    const statusColor = onTarget ? "#059669" : diff < 0 ? "#dc2626" : "#d97706";
                    const statusLabel = onTarget ? "ON TARGET"
                      : diff < 0 ? `SHORT €${Math.abs(Math.round(diff / 1000))}k`
                      : `OVER €${Math.round(diff / 1000)}k`;
                    return (
                      <div key={b.label} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
                        <div style={{ width: 3, background: b.color, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#eee" }}>{b.label}</span>
                            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                              <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>target €{Math.round(b.target / 1000)}k</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, fontFamily: "monospace" }}>{statusLabel}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>{b.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 10, fontSize: 10, color: "#555", lineHeight: 1.5 }}>
                    Satellite holdings (GOOG, AMZN, XAIX) must stay ≤ 10% of portfolio = <span style={{ color: "#aaa", fontFamily: "monospace" }}>€{Math.round(satelliteCap / 1000)}k</span> max. Remainder of B3 in VWCE.
                  </div>
                </Card>
              );
            })()}

            <Card style={{ marginTop: 12, borderLeft: "3px solid #dc2626" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Hard Rules</div>
              {[
                "Fortress has a euro FLOOR (GK B1). If % gives less than floor, fund to floor.",
                "Never sell Growth in a drawdown. That's what Fortress + TermShield exist for.",
                "Rebalance with new money only. Exception: annual rebalance post-FIRE.",
                "All sells direct-routed to IBIS/IBIS2 or BVME.ETF. No SMART on sells.",
                "Review this framework in September annually. No mid-year impulse changes.",
                "GK: when a guardrail triggers, apply the ±10% adjustment immediately in the Withdrawals tab.",
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
              <div style={{ marginBottom: 16, padding: "10px 12px", background: "#0d0d0d", borderRadius: 6, borderLeft: "3px solid #2563eb" }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>Monthly IBKR Contribution (calculated)</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: effectiveMonthlyContrib > 0 ? "#93c5fd" : "#555" }}>
                  €{Math.round(effectiveMonthlyContrib).toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: "#555" }}>/mo</span>
                </div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
                  {effectiveMonthlyContrib > 0
                    ? `Income €${Math.round(totalMonthlyIncome).toLocaleString()} − Expenses €${Math.round(plovGross / 12).toLocaleString()} = €${Math.round(netMonthlyCashflow).toLocaleString()} surplus`
                    : flags.employed || flags.extraIncome
                      ? `Income €${Math.round(totalMonthlyIncome).toLocaleString()} covered by expenses — no surplus to invest`
                      : "No income flags active — set income in the Runway & Levers tab"}
                </div>
              </div>
              <Slider label="Expected Real Return" value={realReturn} onChange={setRealReturn} min={2} max={10} step={0.5} color="#059669" format={v => `${v.toFixed(1)}`} suffix="% / yr" />
              <div style={{ fontSize: 10, color: "#555", marginTop: -8 }}>
                5% real = ~7-8% nominal minus 2-3% inflation. Conservative for 80%+ equity.
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: "0 0 12px" }}>Time to FIRE Milestones</h3>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 12 }}>
                {effectiveMonthlyContrib > 0 ? `Assumes €${Math.round(effectiveMonthlyContrib).toLocaleString()}/mo net contributions (income minus expenses).` : "No net surplus — portfolio growth only."}
              </div>

              <ProjectionRow label="Lean FIRE" months={projections.p500} target={500000} color="#2563eb" />
              <ProjectionRow label="Aggressive FIRE (4.0% GK IWR)" months={projections.aggressive} target={FIRE_TARGETS.aggressive} color="#d97706" />
              <ProjectionRow label="Recommended FIRE (3.5% → GK safe zone)" months={projections.recommended} target={FIRE_TARGETS.recommended} color="#059669" />
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

            {/* GK POST-FIRE SUSTAINABILITY */}
            <Card style={{ borderLeft: "3px solid #8b5cf6" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>GK Model: Post-FIRE Sustainability</div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 14 }}>
                Simulates Guyton-Klinger from the €625k FIRE target with current expense level. Assumptions: 7.5% nominal return, 2.5% inflation.
              </div>
              {(() => {
                const initWR = FIRE_TARGETS.recommended > 0 ? (plovTotal / FIRE_TARGETS.recommended) * 100 : 0;
                const initTheme = getSWRTheme(initWR);
                const rows50 = runGKSimulation({
                  startPortfolio: FIRE_TARGETS.recommended,
                  startWithdrawal: plovTotal,
                  nominalReturn: 0.075,
                  inflation: 0.025,
                  years: 50,
                });
                const keyYears = [10, 20, 30, 40, 50];
                return (
                  <div>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>
                      From <strong style={{ color: "#aaa" }}>€{FIRE_TARGETS.recommended / 1000}k</strong> ·
                      €{Math.round(plovTotal).toLocaleString()}/yr draw ·
                      Initial IWR: <span style={{ color: initTheme.color, fontWeight: 700 }}>{initWR.toFixed(2)}% ({initTheme.label})</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                      {keyYears.map(y => {
                        const row = rows50.find(r => r.year === y) || (rows50.length < y ? null : rows50[rows50.length - 1]);
                        if (!row) return (
                          <div key={y} style={{ padding: "8px 10px", background: "#1a1a1a", borderRadius: 6, textAlign: "center", border: "1px solid #3a1e1e" }}>
                            <div style={{ fontSize: 10, color: "#555" }}>Year {y}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", fontFamily: "monospace" }}>DEPLETED</div>
                          </div>
                        );
                        const alive = row.portfolioEnd > 1000;
                        return (
                          <div key={y} style={{ padding: "8px 10px", background: "#1a1a1a", borderRadius: 6, textAlign: "center", border: `1px solid ${alive ? "#1a2e1a" : "#3a1e1e"}` }}>
                            <div style={{ fontSize: 10, color: "#555" }}>Year {y}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: alive ? "#059669" : "#dc2626", fontFamily: "monospace" }}>
                              {alive ? `€${Math.round(row.portfolioEnd / 1000)}k` : "DEPLETED"}
                            </div>
                            {alive && <div style={{ fontSize: 9, color: "#444", fontFamily: "monospace", marginTop: 2 }}>€{Math.round(row.finalWithdrawal / 1000)}k/yr</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", lineHeight: 1.5 }}>
                      GK dynamically adjusts annual withdrawal: raises by inflation when returns are positive, skips raise after a loss year,
                      cuts 10% if WR exceeds 4.8%, raises 10% if WR drops below 3.2%.
                      For detailed year-by-year simulation use the <strong style={{ color: "#aaa" }}>Withdrawals</strong> tab.
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* TAB: WITHDRAWALS */}
        {tab === "withdrawals" && (
          <div style={{ marginBottom: 28 }}>

            {/* GK RULES OVERVIEW */}
            <Card style={{ marginBottom: 16, borderLeft: "3px solid #8b5cf6" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Guyton-Klinger Dynamic Withdrawal Strategy</div>
              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7, marginBottom: 18 }}>
                The problem with a fixed "withdraw 3.5% every year" rule: it doesn't respond to reality. A fixed rule is too conservative in
                great markets (leaving money on the table) and too rigid in bad ones (ignoring portfolio stress). Guyton-Klinger (GK) solves
                this by working with an <strong style={{ color: "#ccc" }}>annual dollar amount</strong> rather than a fixed percentage.
                You start with a higher rate (4.0% vs 3.5%) and let three automatic rules adjust the amount each year — cutting when the
                portfolio is under pressure, raising when it's running hot. The result: sustainably higher lifetime income without running
                out of money over a 40–50 year horizon.
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: "#8b5cf6", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>How it works each year — the annual process</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {[
                  {
                    step: "1",
                    title: "Start from last year's withdrawal dollar amount",
                    desc: "GK tracks a specific annual withdrawal in euros (e.g. €25,000/yr), not a percentage. You never recalculate from scratch — you adjust the previous year's amount. This means your income is stable by default and only changes when a rule fires.",
                  },
                  {
                    step: "2",
                    title: "Apply the Inflation Rule (or skip it)",
                    desc: "Raise this year's withdrawal by the actual CPI rate (capped at 6% even if inflation is higher). The critical exception: if last year's portfolio return was negative, skip the inflation raise entirely. You just hold the same amount. The portfolio needs breathing room in loss years.",
                  },
                  {
                    step: "3",
                    title: "Calculate your current Withdrawal Rate (WR)",
                    desc: "Divide the proposed withdrawal by your current portfolio value. Example: €26,000 ÷ €650,000 = 4.0% WR. This is the key metric — where it sits relative to the guardrails determines whether a rule fires.",
                  },
                  {
                    step: "4",
                    title: "Apply guardrail rules if WR has crossed a threshold",
                    desc: "At most one rule fires per year. Capital Preservation (WR too high → cut 10%) takes priority over Prosperity (WR too low → raise 10%). If WR is between 3.2% and 4.8%, no rule fires and the inflation-adjusted amount stands.",
                  },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", gap: 12, padding: "10px 12px", background: "#141414", borderRadius: 6, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#8b5cf6", minWidth: 24, lineHeight: 1.2, flexShrink: 0 }}>{s.step}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc", marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: "#8b5cf6", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>The three rules in detail</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
                {[
                  {
                    label: "Inflation Rule",
                    color: "#d97706",
                    trigger: "Every year (default)",
                    action: "Raise withdrawal by CPI, capped at 6%",
                    exception: "SKIP entirely if last year's return was negative",
                    why: "Preserves your real purchasing power in normal years. The skip clause prevents you from compounding your withdrawal during a bad market year — giving the portfolio a chance to recover before you demand more from it.",
                    example: "Base €25,000, CPI = 3% → new amount €25,750. But if last year was −10%: amount stays €25,000.",
                  },
                  {
                    label: "Capital Preservation Rule",
                    color: "#dc2626",
                    trigger: "When WR > 4.8%",
                    action: "Cut withdrawal by 10% immediately",
                    exception: null,
                    why: "The portfolio is under stress — you're drawing too much relative to its current size. A 10% cut reduces the draw and gives the portfolio room to recover. This fires even in good years if WR is elevated (e.g. after an inflation raise).",
                    example: "WR hits 5.1% → proposed €27,000 → after cut: €24,300. WR drops back below 4.8%.",
                  },
                  {
                    label: "Prosperity Rule",
                    color: "#2563eb",
                    trigger: "When WR < 3.2%",
                    action: "Raise withdrawal by 10%",
                    exception: "Only fires if Capital Preservation did NOT fire",
                    why: "The portfolio is growing faster than you're withdrawing — you're leaving money on the table. A 10% raise captures upside and rewards you for a strong market sequence. The portfolio is well ahead of your spending.",
                    example: "Portfolio grew 20%, WR drops to 2.9% → proposed €24,500 → after raise: €26,950.",
                  },
                ].map(r => (
                  <div key={r.label} style={{ padding: "14px", background: "#1a1a1a", borderRadius: 8, borderLeft: `3px solid ${r.color}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: r.color, marginBottom: 10 }}>{r.label}</div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Trigger</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{r.trigger}</div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Action</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{r.action}</div>
                    </div>
                    {r.exception && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Exception</div>
                        <div style={{ fontSize: 11, color: "#f87171" }}>{r.exception}</div>
                      </div>
                    )}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Why</div>
                      <div style={{ fontSize: 10, color: "#666", lineHeight: 1.6 }}>{r.why}</div>
                    </div>
                    <div style={{ padding: "6px 8px", background: "#111", borderRadius: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Example</div>
                      <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace", lineHeight: 1.5 }}>{r.example}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div style={{ padding: "10px 12px", background: "#111", borderRadius: 6, fontSize: 10, color: "#555", fontFamily: "monospace", lineHeight: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#666", marginBottom: 6, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.08em" }}>Configuration used in this dashboard</div>
                  Initial Withdrawal Rate: <strong style={{ color: "#aaa" }}>4.0%</strong> of portfolio at FIRE date<br />
                  Prosperity guardrail: <strong style={{ color: "#2563eb" }}>WR &lt; 3.2%</strong> → raise +10%<br />
                  Capital Preservation: <strong style={{ color: "#dc2626" }}>WR &gt; 4.8%</strong> → cut −10%<br />
                  Annual adjustment: <strong style={{ color: "#aaa" }}>±10%</strong> per triggered rule<br />
                  Inflation cap: <strong style={{ color: "#aaa" }}>6%/yr</strong> maximum raise
                </div>
                <div style={{ padding: "10px 12px", background: "#111", borderRadius: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", marginBottom: 6 }}>Why a positive year can produce a LOWER withdrawal than a negative year</div>
                  <div style={{ fontSize: 10, color: "#555", lineHeight: 1.7 }}>
                    In a negative year, the inflation raise is simply <strong style={{ color: "#777" }}>skipped</strong> — you hold last year's amount.<br />
                    In a positive year, the inflation raise is <strong style={{ color: "#777" }}>applied first</strong>, then the WR is checked. If the raise pushes WR above
                    4.8%, the Capital Preservation Rule fires and cuts 10% — resulting in a <em>lower</em> final withdrawal than skipping the raise would have given.
                    This is by design: portfolio protection takes priority over income maximisation.
                  </div>
                </div>
              </div>
            </Card>

            {/* CURRENT YEAR CHECK + BASE WITHDRAWAL */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>

              <Card highlight>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>This Year's Withdrawal Check</div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 14 }}>
                  Enter your current portfolio value and last year's data to get the GK-recommended withdrawal for this year.
                </div>

                <Slider label="Current Portfolio Value" value={checkPortfolio}
                  onChange={setGkCheckPortfolio}
                  min={50000} max={1500000} step={1000} color="#8b5cf6"
                  format={v => `€${Math.round(v / 1000)}k`} suffix="" />
                <div style={{ fontSize: 10, color: "#444", marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                  Your portfolio balance <em>right now</em> — after last year's return has already been realised.
                  {gkCheckPortfolio > 0 && gkCheckPortfolio !== portfolio && (
                    <span
                      onClick={() => setGkCheckPortfolio(0)}
                      style={{ marginLeft: 8, color: "#8b5cf6", cursor: "pointer", textDecoration: "underline" }}
                    >
                      Reset to main portfolio (€{Math.round(portfolio / 1000)}k)
                    </span>
                  )}
                </div>

                <Slider label="Last Year's Portfolio Return" value={gkLastReturn} onChange={setGkLastReturn} min={-30} max={30} step={0.5} color="#059669"
                  format={v => v >= 0 ? `+${v.toFixed(1)}` : `${v.toFixed(1)}`} suffix="%" />
                <div style={{ fontSize: 10, color: "#444", marginTop: -8, marginBottom: 12, lineHeight: 1.5 }}>
                  Only the <strong style={{ color: "#666" }}>sign</strong> matters here — positive = inflation raise is applied this year, negative = raise is skipped.
                  The magnitude of the return is already reflected in the portfolio value above.
                </div>

                <Slider label="This Year's Inflation (CPI)" value={gkThisInflation} onChange={setGkThisInflation} min={0} max={10} step={0.1} color="#d97706"
                  format={v => v.toFixed(1)} suffix="%" />
                <div style={{ fontSize: 10, color: "#444", marginTop: -8, marginBottom: 14, lineHeight: 1.5 }}>
                  The inflation rate used to adjust your withdrawal (capped at 6% even if actual CPI is higher).
                </div>

                {(() => {
                  const zone = getGKZoneStyle(currentYearGK.wr * 100);
                  const positiveYearWithCut = gkLastReturn >= 0 && currentYearGK.trigger === "CAPITAL_PRESERVATION";
                  return (
                    <div style={{ padding: "12px 14px", background: "#1a1a1a", borderRadius: 8, border: `1px solid ${zone.bg}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>GK base withdrawal (last year)</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>€{Math.round(effectiveBaseWithdrawal).toLocaleString()}/yr</span>
                      </div>
                      {gkLastReturn < 0 && (
                        <div style={{ marginBottom: 8, padding: "6px 8px", background: "#2a1515", borderRadius: 4, fontSize: 10, color: "#f87171", lineHeight: 1.5 }}>
                          Negative return year → inflation raise <strong>SKIPPED</strong>. Withdrawal stays at last year's amount.
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>After inflation adjustment (proposed)</span>
                        <span style={{ fontSize: 12, color: "#aaa", fontFamily: "monospace" }}>€{Math.round(currentYearGK.proposedWithdrawal).toLocaleString()}/yr</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>WR before guardrail check</span>
                        <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>
                          €{Math.round(currentYearGK.proposedWithdrawal).toLocaleString()} ÷ €{Math.round(checkPortfolio).toLocaleString()} = {((currentYearGK.proposedWithdrawal / checkPortfolio) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>GK rule fired</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: currentYearGK.trigger ? zone.color : "#555" }}>
                          {currentYearGK.trigger === "CAPITAL_PRESERVATION" ? "↓ Capital Preservation −10%" :
                           currentYearGK.trigger === "PROSPERITY" ? "↑ Prosperity +10%" : "None — within guardrails"}
                        </span>
                      </div>
                      {positiveYearWithCut && (
                        <div style={{ marginBottom: 8, padding: "6px 8px", background: "#2a1a10", borderRadius: 4, fontSize: 10, color: "#fb923c", lineHeight: 1.5 }}>
                          Positive year, but the inflation raise pushed WR above 4.8% — Capital Preservation cut overrides it.
                          Final amount is lower than a year where the raise was simply skipped. This is correct GK behaviour.
                        </div>
                      )}
                      <div style={{ height: 1, background: "#333", margin: "8px 0" }} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#ccc" }}>Recommended withdrawal</span>
                        <span style={{ fontSize: 17, fontWeight: 800, color: zone.color, fontFamily: "monospace" }}>€{Math.round(currentYearGK.finalWithdrawal).toLocaleString()}/yr</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Final Withdrawal Rate</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: zone.color, fontFamily: "monospace" }}>
                          {(currentYearGK.wr * 100).toFixed(2)}% · {zone.label}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button onClick={() => setGkBaseWithdrawal(Math.round(currentYearGK.finalWithdrawal))} style={{
                  width: "100%", marginTop: 10, padding: "9px",
                  background: "#1a2e1a", border: "1px solid #059669",
                  borderRadius: 6, color: "#6ee7b7",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                }}>
                  Apply as New Base (€{Math.round(currentYearGK.finalWithdrawal).toLocaleString()}/yr)
                </button>
              </Card>

              <Card highlight>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>GK Base Withdrawal &amp; IWR</div>
                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.7, marginBottom: 16 }}>
                  <strong style={{ color: "#888" }}>GK Base Withdrawal</strong> is the annual withdrawal amount you're currently working from.
                  It's a dollar figure (e.g. €25,000/yr), not a percentage. You set it once at FIRE date using the IWR, and
                  then update it each year after applying the GK rules. All future adjustments are relative to this number.
                  <br /><br />
                  <strong style={{ color: "#888" }}>IWR (Initial Withdrawal Rate)</strong> is the percentage of your portfolio you withdraw in Year 1 of retirement.
                  GK uses 4.0% as the starting rate — higher than the conservative 3.5% SWR, justified by the guardrail
                  rules that protect against over-withdrawal. At €{(FIRE_TARGETS.recommended / 1000).toFixed(0)}k portfolio,
                  a 4.0% IWR = €{Math.round(FIRE_TARGETS.recommended * 0.04).toLocaleString()}/yr.
                </div>

                <Slider label="GK Base Withdrawal" value={Math.max(10000, Math.round(effectiveBaseWithdrawal))}
                  onChange={v => setGkBaseWithdrawal(v)}
                  min={10000} max={80000} step={500} color="#8b5cf6"
                  format={v => `€${v.toLocaleString()}`} suffix="/yr" />
                <div style={{ fontSize: 10, color: "#444", marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>
                  When set to 0, defaults to your annual expense setting. Update this after each year's "Apply as New Base" action.
                </div>

                {(() => {
                  const zone = getGKZoneStyle(currentGKWR);
                  return (
                    <div style={{ padding: "12px 14px", background: "#1a1a1a", borderRadius: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                        Current status (base withdrawal ÷ main portfolio)
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Current Withdrawal Rate (IWR)</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: zone.color, fontFamily: "monospace" }}>{currentGKWR.toFixed(2)}%</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>GK Zone</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: zone.color }}>{zone.label}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, color: "#666" }}>Monthly equivalent</span>
                        <span style={{ fontSize: 12, color: "#aaa", fontFamily: "monospace" }}>€{Math.round(effectiveBaseWithdrawal / 12).toLocaleString()}/mo</span>
                      </div>
                      <div style={{ height: 1, background: "#222", margin: "8px 0" }} />
                      <div style={{ fontSize: 10, color: "#444", lineHeight: 1.7, marginTop: 8 }}>
                        <strong style={{ color: "#666" }}>GK Zone</strong> tells you where your current withdrawal rate sits relative to the guardrails:
                        <br />
                        <span style={{ color: "#2563eb" }}>■</span> <strong style={{ color: "#666" }}>GK SAFE</strong> (WR &lt; 3.2%) — portfolio running hot, Prosperity Rule eligible<br />
                        <span style={{ color: "#059669" }}>■</span> <strong style={{ color: "#666" }}>GK HEALTHY</strong> (3.2%–4.0%) — well within guardrails, no rule fires<br />
                        <span style={{ color: "#d97706" }}>■</span> <strong style={{ color: "#666" }}>GK ELEVATED</strong> (4.0%–4.8%) — above IWR but still within guardrails, monitor closely<br />
                        <span style={{ color: "#dc2626" }}>■</span> <strong style={{ color: "#666" }}>CUT −10%</strong> (WR &gt; 4.8%) — Capital Preservation Rule fires, withdrawal cut by 10%
                      </div>
                    </div>
                  );
                })()}

                {gkBaseWithdrawal > 0 && (
                  <button onClick={() => setGkBaseWithdrawal(0)} style={{
                    marginTop: 10, padding: "5px 10px", background: "transparent",
                    border: "1px solid #333", borderRadius: 4, color: "#555",
                    fontSize: 10, cursor: "pointer", fontFamily: "inherit"
                  }}>
                    Reset to expense level
                  </button>
                )}
              </Card>
            </div>

            {/* 40-YEAR SIMULATION */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>40-Year GK Simulation</div>
                <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
                  {gkNominalReturn.toFixed(1)}% nominal · {gkInflation.toFixed(1)}% inflation · real {(gkNominalReturn - gkInflation).toFixed(1)}%
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <Slider label="Expected Nominal Return" value={gkNominalReturn} onChange={setGkNominalReturn} min={2} max={14} step={0.5} color="#059669" format={v => v.toFixed(1)} suffix="%" />
                <Slider label="Expected Inflation" value={gkInflation} onChange={setGkInflation} min={0} max={8} step={0.1} color="#d97706" format={v => v.toFixed(1)} suffix="%" />
              </div>

              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 520 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #333" }}>
                      {["Yr", "Portfolio Start", "Proposed", "Trigger", "Withdrawal", "WR", "End Balance"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: h === "Yr" ? "center" : "right", color: "#444", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {simRows.map(row => {
                      const wrStyle = getSWRTheme(row.wr);
                      const isKeyYear = [5, 10, 15, 20, 25, 30, 35, 40].includes(row.year);
                      return (
                        <tr key={row.year} style={{
                          borderBottom: "1px solid #0f0f0f",
                          background: isKeyYear ? "#141414" : "transparent",
                          opacity: row.portfolioEnd <= 0 ? 0.4 : 1,
                        }}>
                          <td style={{ padding: "5px 8px", textAlign: "center", color: isKeyYear ? "#fff" : "#666", fontWeight: isKeyYear ? 700 : 400 }}>{row.year}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#888" }}>€{Math.round(row.portfolioStart / 1000)}k</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#666" }}>€{Math.round(row.proposedWithdrawal / 1000)}k</td>
                          <td style={{ padding: "5px 8px", textAlign: "right" }}>
                            {row.trigger ? (
                              <span style={{
                                fontSize: 9, padding: "2px 5px", borderRadius: 3, fontWeight: 700,
                                background: row.trigger === "PROSPERITY" ? "#1e3a5f" : "#7f1d1d",
                                color: row.trigger === "PROSPERITY" ? "#93c5fd" : "#fca5a5",
                              }}>
                                {row.trigger === "PROSPERITY" ? "↑ PROSPER" : "↓ CUT"}
                              </span>
                            ) : <span style={{ color: "#222" }}>—</span>}
                          </td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#ccc", fontWeight: isKeyYear ? 700 : 400 }}>€{Math.round(row.finalWithdrawal).toLocaleString()}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: wrStyle.color, fontWeight: 700 }}>{row.wr.toFixed(1)}%</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: row.portfolioEnd > 0 ? "#059669" : "#dc2626", fontWeight: isKeyYear ? 700 : 400 }}>
                            {row.portfolioEnd > 0 ? `€${Math.round(row.portfolioEnd / 1000)}k` : "DEPLETED"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* WITHDRAWAL HISTORY LOG */}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Withdrawal Log</div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Record each year's actual data to track GK adjustments over time</div>
                </div>
                <button onClick={() => {
                  if (!showAddGKEntry) setGkEntryPortfolioStart(portfolio);
                  setShowAddGKEntry(!showAddGKEntry);
                }} style={{
                  padding: "6px 12px",
                  background: showAddGKEntry ? "#222" : "#1a2e1a",
                  border: `1px solid ${showAddGKEntry ? "#333" : "#059669"}`,
                  borderRadius: 5, color: showAddGKEntry ? "#888" : "#6ee7b7",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                }}>
                  {showAddGKEntry ? "Cancel" : "+ Record Year"}
                </button>
              </div>

              {showAddGKEntry && (
                <div style={{ padding: "14px", background: "#1a1a1a", borderRadius: 8, marginBottom: 14, border: "1px solid #2a2a2a" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#ccc", marginBottom: 12 }}>Record Actual Year Data</div>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Year Label</div>
                      <input value={gkEntryYear} onChange={e => setGkEntryYear(e.target.value)} style={{
                        width: "100%", background: "#111", border: "1px solid #333", borderRadius: 4,
                        color: "#fff", padding: "7px 10px", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box",
                      }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Portfolio Start (€)</div>
                      <input type="number" value={gkEntryPortfolioStart} onChange={e => setGkEntryPortfolioStart(Number(e.target.value))} style={{
                        width: "100%", background: "#111", border: "1px solid #333", borderRadius: 4,
                        color: "#fff", padding: "7px 10px", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box",
                      }} />
                    </div>
                  </div>
                  <Slider label="Actual Portfolio Return" value={gkEntryReturn} onChange={setGkEntryReturn} min={-30} max={30} step={0.5} color="#059669"
                    format={v => v >= 0 ? `+${v.toFixed(1)}` : `${v.toFixed(1)}`} suffix="%" />
                  <Slider label="Actual Inflation" value={gkEntryInflation} onChange={setGkEntryInflation} min={0} max={10} step={0.1} color="#d97706"
                    format={v => v.toFixed(1)} suffix="%" />

                  {(() => {
                    const preview = calcGKNextStep({
                      portfolio: gkEntryPortfolioStart,
                      lastWithdrawal: lastHistoryWithdrawal,
                      annualNominalReturn: gkEntryReturn / 100,
                      inflation: gkEntryInflation / 100,
                    });
                    const z = getGKZoneStyle(preview.wr * 100);
                    return (
                      <div style={{ padding: "10px 12px", background: "#111", borderRadius: 6, marginBottom: 12, fontSize: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: "#666" }}>Last withdrawal base</span>
                          <span style={{ color: "#aaa", fontFamily: "monospace" }}>€{Math.round(lastHistoryWithdrawal).toLocaleString()}/yr</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ color: "#666" }}>Proposed (after inflation)</span>
                          <span style={{ color: "#aaa", fontFamily: "monospace" }}>€{Math.round(preview.proposedWithdrawal).toLocaleString()}/yr</span>
                        </div>
                        {preview.trigger && (
                          <div style={{ marginBottom: 4, color: z.color, fontWeight: 700 }}>
                            GK Rule: {preview.trigger === "CAPITAL_PRESERVATION" ? "↓ Capital Preservation −10%" : "↑ Prosperity +10%"}
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#ccc", fontWeight: 700 }}>Final withdrawal</span>
                          <span style={{ color: z.color, fontWeight: 800, fontFamily: "monospace" }}>
                            €{Math.round(preview.finalWithdrawal).toLocaleString()}/yr · {(preview.wr * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <button onClick={addGKHistoryEntry} style={{
                    width: "100%", padding: "10px", background: "#1a2e1a",
                    border: "1px solid #059669", borderRadius: 6,
                    color: "#6ee7b7", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Save Entry & Update Base Withdrawal
                  </button>
                </div>
              )}

              {gkHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: "#444", textAlign: "center", padding: "28px 0", lineHeight: 1.6 }}>
                  No withdrawal records yet.<br />
                  <span style={{ fontSize: 11 }}>Use "+ Record Year" to log each year's actual return and inflation.</span>
                </div>
              ) : (
                <div>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "monospace", minWidth: 560 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #333" }}>
                          {["Year", "Portfolio", "Return", "Inflation", "Base", "Withdrawal", "WR", "Rule"].map(h => (
                            <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: "#444", fontWeight: 600, fontSize: 10 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {gkHistory.map(entry => {
                          const z = getGKZoneStyle(entry.wr);
                          return (
                            <tr key={entry.id} style={{ borderBottom: "1px solid #111" }}>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#fff", fontWeight: 700 }}>{entry.yearLabel}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>€{Math.round(entry.portfolioStart / 1000)}k</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: entry.actualReturn >= 0 ? "#059669" : "#dc2626" }}>
                                {entry.actualReturn >= 0 ? "+" : ""}{entry.actualReturn.toFixed(1)}%
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#d97706" }}>{entry.actualInflation.toFixed(1)}%</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#555" }}>€{Math.round(entry.lastWithdrawal / 1000)}k</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#ccc", fontWeight: 700 }}>€{Math.round(entry.finalWithdrawal).toLocaleString()}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: z.color, fontWeight: 700 }}>{entry.wr.toFixed(2)}%</td>
                              <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                {entry.trigger ? (
                                  <span style={{
                                    fontSize: 9, padding: "2px 5px", borderRadius: 3, fontWeight: 700,
                                    background: entry.trigger === "PROSPERITY" ? "#1e3a5f" : "#7f1d1d",
                                    color: entry.trigger === "PROSPERITY" ? "#93c5fd" : "#fca5a5",
                                  }}>
                                    {entry.trigger === "PROSPERITY" ? "↑" : "↓"}
                                  </span>
                                ) : <span style={{ color: "#333" }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={() => {
                    if (window.confirm("Clear all withdrawal history? This cannot be undone.")) setGkHistory([]);
                  }} style={{
                    marginTop: 12, padding: "5px 10px", background: "transparent",
                    border: "1px solid #2a2a2a", borderRadius: 4, color: "#444",
                    fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Clear History
                  </button>
                </div>
              )}
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
          Joseph Harari · U15566654 · v{APP_VERSION} · Bulgarian Tax Resident ·
          FIRE Target €{FIRE_TARGETS.recommended / 1000}k
          (GK IWR 4.0% · guardrails 3.2% / 4.8% on {plovTotal.toLocaleString("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}/yr) ·
          Last framework revision: May 2026
          <br />State auto-saves. Update portfolio value monthly.
        </div>

      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Dashboard />);
