// ─── Compass FIRE Planner — Engine (pure math, state shape preserved) ───
// Logic is identical to the original; only the UI shell on top is redesigned.

const APP_VERSION = "20260506.1";

const GK_CONFIG = {
  IWR: 0.04,
  UPPER_GUARDRAIL: 0.032,
  LOWER_GUARDRAIL: 0.048,
  ADJUSTMENT: 0.10,
  INFLATION_CAP: 0.06,
};

const fmtEur = (n) => `€${Math.round(Number(n) || 0).toLocaleString("en-GB")}`;
const fmtEurK = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `€${Math.round(v/1000)}k`;
  return `€${Math.round(v)}`;
};
const fmtPct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

// Zone semantics — labels describe state, not commands.
function getGKZone(wr) {
  if (wr <= 0)                                  return { id: "covered",    label: "Covered",        tone: "good",    color: "var(--good)"   };
  if (wr > GK_CONFIG.LOWER_GUARDRAIL * 100)     return { id: "cut",        label: "Cut zone",       tone: "bad",     color: "var(--bad)"    };
  if (wr > GK_CONFIG.IWR * 100)                 return { id: "elevated",   label: "Elevated",       tone: "warn",    color: "var(--warn)"   };
  if (wr > GK_CONFIG.UPPER_GUARDRAIL * 100)     return { id: "safe",       label: "Safe",           tone: "good",    color: "var(--good)"   };
  return                                               { id: "prosperity", label: "Prosperity",     tone: "accent",  color: "var(--accent)" };
}

const PHASES = {
  employed: {
    id: "employed", label: "Employed", subtitle: "Accumulating — salary flowing",
    buckets: {
      growth:     { target: 84, range: [82,87], floor: null,  note: "VWCE core. Single provider OK below €500k." },
      fortress:   { target: 7,  range: [6,8],   floor: 30000, note: "~16–18 months expenses. Draw first if laid off." },
      termShield: { target: 5,  range: [4,6],   floor: 18000, note: "29GA until Q1 2029, then reassess instrument." },
      cash:       { target: 4,  range: [0,5],   floor: null,  note: "DCA deployment buffer — drive toward 0%." },
    },
  },
  laid_off: {
    id: "laid_off", label: "Sabbatical", subtitle: "No income — fortress mode",
    buckets: {
      growth:     { target: 82, range: [78,85], floor: null,  note: "Do not sell. Freeze. Let it compound." },
      fortress:   { target: 10, range: [8,12],  floor: 35000, note: "Severance lands here. Draw first." },
      termShield: { target: 5,  range: [4,7],   floor: 18000, note: "Draw second, after fortress depleted." },
      cash:       { target: 3,  range: [1,5],   floor: null,  note: "Severance overflow + operating liquidity." },
    },
  },
  lean_fire: {
    id: "lean_fire", label: "Lean FIRE", subtitle: "Part-time income + portfolio growth",
    buckets: {
      growth:     { target: 78, range: [72,82], floor: null,  note: "Multi-provider above €500k." },
      fortress:   { target: 8,  range: [6,12],  floor: 40000, note: "GK B1 — 2yr safety net. Draw first." },
      termShield: { target: 10, range: [8,14],  floor: 55000, note: "GK B2 partial. Roll toward 5yr target." },
      cash:       { target: 4,  range: [2,5],   floor: null,  note: "Operating buffer + opportunity fund." },
    },
  },
  full_fire: {
    id: "full_fire", label: "Full FIRE", subtitle: "Living off the portfolio",
    buckets: {
      growth:     { target: 72, range: [65,78], floor: null,   note: "Multi-provider mandatory. Rebalance annually." },
      fortress:   { target: 8,  range: [6,12],  floor: 44000,  note: "GK B1 — 2yr expenses. Refill from B2." },
      termShield: { target: 16, range: [12,20], floor: 110000, note: "GK B2 — 5yr expenses. Refill B1." },
      cash:       { target: 4,  range: [2,6],   floor: null,   note: "3–6 months immediate liquidity." },
    },
  },
};

const BUCKET_META = {
  growth:     { label: "Growth",    sub: "VWCE",                inst: "VWCE",            color: "var(--b-growth)",   raw: "#7aa2ff", short: "Compounding machine. Never sell in drawdowns." },
  fortress:   { label: "Safety",    sub: "XEON (€STR)",         inst: "XEON",            color: "var(--b-fortress)", raw: "#6cd49a", short: "GK B1 — 2yr liquidity. Layoff runway." },
  termShield: { label: "Stability", sub: "Bonds / Bond ETF",    inst: "Bonds",           color: "var(--b-fixed)",    raw: "#f5b86b", short: "GK B2 — 5yr stability. Refill Safety." },
  cash:       { label: "Cash",      sub: "EUR @ IBKR",          inst: "EUR cash",        color: "var(--b-cash)",     raw: "#8c8c87", short: "DCA buffer or opportunity fund." },
};

const TRIGGERS = [
  { event: "Layoff confirmed",                    action: "Cancel DCA → route cash to XEON. Switch to Sabbatical. Do NOT sell VWCE.", urgency: "immediate", category: "employment" },
  { event: "Portfolio hits €500k",                action: "Split new DCA: 60% VWCE / 40% SPYI or ISAC for provider diversification.", urgency: "month", category: "milestone" },
  { event: "Portfolio hits €625k",                action: "FIRE-Ready. Fortress floor → €44k (GK B1). TermShield → €110k (GK B2).",   urgency: "month", category: "milestone" },
  { event: "Art. 13 repealed (10% CGT)",          action: "April 2026 reset is safe. Activate Beckham Law research → decide within 60 days.", urgency: "quarter", category: "tax" },
  { event: "€STR drops below 1.5%",               action: "Review XEON yield. Consider short-dated EUR govt bond ETF alternative.",   urgency: "quarter", category: "market" },
  { event: "March 2029 — 29GA dissolution",       action: "Sell 29GA on BVME.ETF via directed limit order. Do NOT wait for December.", urgency: "immediate", category: "calendar" },
  { event: "Market drawdown > 25%",               action: "Deploy strategic cash into growth. Skip GK inflation raise next year.",     urgency: "week", category: "market" },
  { event: "Daughter starts private school",      action: "Add €10–13k/yr to expenses. Recalculate GK IWR. If > 4.8%, apply cut.",     urgency: "month", category: "life" },
  { event: "Wife starts earning income",          action: "Reduce fortress floor by ~50% of her annual. Recalculate GK IWR.",           urgency: "quarter", category: "life" },
  { event: "New employment in Spain",             action: "File Beckham Law (Form 149) within 6 months of entering Spanish SS.",       urgency: "immediate", category: "relocation" },
];

// ─── GK Calculation Engine (unchanged) ───
function calcGKNextStep({ portfolio, lastWithdrawal, annualNominalReturn, inflation, initialWR = GK_CONFIG.IWR }) {
  if (portfolio <= 0) return { proposedWithdrawal: 0, finalWithdrawal: 0, trigger: "DEPLETED", wr: 0 };

  let proposedWithdrawal = lastWithdrawal;
  const currentWRPreRaise = lastWithdrawal / portfolio;
  const skipInflationRaise = annualNominalReturn < 0 && currentWRPreRaise > initialWR;
  if (!skipInflationRaise) {
    const capped = Math.min(inflation, GK_CONFIG.INFLATION_CAP);
    proposedWithdrawal = lastWithdrawal * (1 + capped);
  }

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

function runGKSimulation({ startPortfolio, startWithdrawal, nominalReturn, inflation, returnPath, inflationPath, years = 40, initialWR }) {
  const rows = [];
  let portfolio = startPortfolio;
  let withdrawal = startWithdrawal;
  const seedWR = initialWR ?? (startPortfolio > 0 ? startWithdrawal / startPortfolio : GK_CONFIG.IWR);

  for (let year = 1; year <= years; year++) {
    const portfolioStart = portfolio;
    const ret = returnPath ? returnPath[year - 1] : nominalReturn;
    const inf = inflationPath ? inflationPath[year - 1] : inflation;
    const step = calcGKNextStep({
      portfolio, lastWithdrawal: withdrawal,
      annualNominalReturn: ret, inflation: inf, initialWR: seedWR,
    });
    const endPortfolio = Math.max(0, (portfolioStart - step.finalWithdrawal) * (1 + ret));
    rows.push({
      year, portfolioStart,
      proposedWithdrawal: step.proposedWithdrawal,
      trigger: step.trigger,
      finalWithdrawal: step.finalWithdrawal,
      wr: step.wr * 100,
      portfolioEnd: endPortfolio,
      annualReturn: ret, annualInflation: inf,
    });
    portfolio = endPortfolio;
    withdrawal = step.finalWithdrawal;
    if (portfolio <= 0) break;
  }
  return rows;
}

function gaussianSample() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function sampleReturnPath({ years, equityShare, equityMu, equitySigma, bondMu, bondSigma }) {
  const path = [];
  for (let i = 0; i < years; i++) {
    const eq = equityMu + equitySigma * gaussianSample();
    const bd = bondMu   + bondSigma   * gaussianSample();
    path.push(equityShare * eq + (1 - equityShare) * bd);
  }
  return path;
}

function sampleInflationPath({ years, target, sigma }) {
  const path = [];
  let last = target;
  for (let i = 0; i < years; i++) {
    const drift = 0.6 * (target - last);
    const shock = sigma * gaussianSample();
    last = Math.max(-0.02, last + drift + shock);
    path.push(last);
  }
  return path;
}

function runMonteCarlo({ startPortfolio, startWithdrawal, equityShare, equityMu, equitySigma, bondMu, bondSigma, inflationTarget, inflationSigma, years = 40, paths = 1000 }) {
  const portfolioByYear = Array.from({ length: years }, () => []);
  let depleted = 0;
  let preservationCutCount = 0;

  for (let p = 0; p < paths; p++) {
    const returnPath = sampleReturnPath({ years, equityShare, equityMu, equitySigma, bondMu, bondSigma });
    const inflationPath = sampleInflationPath({ years, target: inflationTarget, sigma: inflationSigma });
    const rows = runGKSimulation({ startPortfolio, startWithdrawal, returnPath, inflationPath, years });

    let cutEarly = false;
    for (let y = 0; y < years; y++) {
      const row = rows[y];
      const value = row ? row.portfolioEnd : 0;
      portfolioByYear[y].push(value);
      if (row && row.trigger === "CAPITAL_PRESERVATION" && y < 10) cutEarly = true;
    }
    if (rows.length === 0 || rows[rows.length - 1].portfolioEnd <= 0) depleted++;
    if (cutEarly) preservationCutCount++;
  }

  const pct = (arr, q) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
    return sorted[idx];
  };

  const bands = portfolioByYear.map((vals, i) => ({
    year: i + 1,
    p10: pct(vals, 0.10), p25: pct(vals, 0.25),
    p50: pct(vals, 0.50),
    p75: pct(vals, 0.75), p90: pct(vals, 0.90),
  }));

  return { bands, successRate: 1 - depleted / paths, preservationCutRate: preservationCutCount / paths, paths };
}

// ─── Derived cashflow + monthly recommendation ───
// Replaces the old salary/savings-rate input model. All inputs are monthly.
function deriveCashflow(state) {
  const phase = PHASES[state.currentPhase] || PHASES.employed;

  // In Sabbatical / FIRE phases, primary salary is zeroed (you can still record partner income).
  const primarySalary = state.currentPhase === "laid_off" ? 0 : (state.monthlySalaryEUR || 0);
  const partnerSalary = (state.monthlySalaryPartnerEUR || 0);

  const incomeMonthly  = primarySalary + partnerSalary;
  const essentials     = state.monthlyEssentialsEUR || 0;
  const fun            = state.monthlyFunEUR || 0;
  const totalExpenses  = essentials + fun;
  const surplusMonthly = incomeMonthly - totalExpenses;

  return {
    primarySalary, partnerSalary, incomeMonthly,
    essentials, fun, totalExpenses,
    surplusMonthly,
    surplusAnnual: surplusMonthly * 12,
    annualExpenses: totalExpenses * 12,
    phase,
  };
}

// Returns the bucket that most needs filling (largest negative drift vs target)
function nextRebalanceBucket(state) {
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  if (portfolio <= 0) return { key: "growth", meta: BUCKET_META.growth, gap: 0, current: 0, targetEur: 0 };
  const phase = PHASES[state.currentPhase] || PHASES.employed;
  const map = [
    { key: "growth",     stateKey: "bucketVWCE",        meta: BUCKET_META.growth },
    { key: "fortress",   stateKey: "bucketXEON",        meta: BUCKET_META.fortress },
    { key: "termShield", stateKey: "bucketFixedIncome", meta: BUCKET_META.termShield },
    { key: "cash",       stateKey: "bucketCash",        meta: BUCKET_META.cash },
  ];
  const items = map.map(b => {
    const cur = state[b.stateKey] || 0;
    const target = phase.buckets[b.key].target / 100;
    const targetEur = portfolio * target;
    const floor = phase.buckets[b.key].floor || 0;
    // Floors take priority; otherwise % drift
    const floorGap = Math.max(0, floor - cur);
    const pctGap = Math.max(0, targetEur - cur);
    return { ...b, cur, target, targetEur, floor, floorGap, pctGap };
  });
  // Priority: any bucket below floor first; else biggest % gap
  const belowFloor = items.filter(i => i.floorGap > 0).sort((a,b) => b.floorGap - a.floorGap);
  if (belowFloor.length > 0) {
    const w = belowFloor[0];
    return { key: w.key, meta: w.meta, gap: w.floorGap, current: w.cur, targetEur: w.floor, reason: "floor" };
  }
  const sorted = items.slice().sort((a,b) => b.pctGap - a.pctGap);
  const w = sorted[0];
  return { key: w.key, meta: w.meta, gap: w.pctGap, current: w.cur, targetEur: w.targetEur, reason: "target" };
}

// Build a 'this month' recommendation. Returns { headline, lines[], tone }.
function monthlyRecommendation(state) {
  const cf = deriveCashflow(state);
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  const fireTarget = cf.annualExpenses / GK_CONFIG.IWR;
  const lastWithdrawal = (state.gkHistory && state.gkHistory.length > 0)
    ? state.gkHistory[state.gkHistory.length - 1].finalWithdrawal
    : cf.annualExpenses;
  const wr = portfolio > 0 ? (lastWithdrawal / portfolio) * 100 : 0;
  const zone = getGKZone(wr);

  if (cf.surplusMonthly >= 0) {
    // Saving phase — recommend transfer to most-needed bucket
    const need = nextRebalanceBucket(state);
    // Hold-back ratio depends on GK zone — be more frugal in Cut, more relaxed in Prosperity
    const holdBackPctOfFun =
      zone.id === "cut"        ? 0.50 :
      zone.id === "elevated"   ? 0.20 :
      zone.id === "prosperity" ? 0    :
                                  0.10;
    const funCut = Math.round(cf.fun * holdBackPctOfFun);
    const transfer = Math.max(0, cf.surplusMonthly + funCut);
    return {
      mode: "surplus", zone, cf, need, fireTarget,
      transfer,
      funKept: cf.fun - funCut,
      funCut,
      headline: `Transfer ${fmtEur(transfer)} to ${need.meta.label} (${need.meta.inst})`,
      tone: "good",
    };
  } else {
    // Withdrawal phase — recommend draw + tighten fun first
    const shortfall = -cf.surplusMonthly;
    const funCut = Math.min(cf.fun, shortfall);
    const drawNeeded = Math.max(0, shortfall - funCut);
    return {
      mode: "shortfall", zone, cf, fireTarget,
      shortfall,
      funKept: Math.max(0, cf.fun - funCut),
      funCut,
      drawNeeded,
      headline: drawNeeded > 0
        ? `Withdraw ${fmtEur(drawNeeded)} from Safety (XEON) this month`
        : `Tighten fun budget by ${fmtEur(funCut)} — no withdrawal needed`,
      tone: "warn",
    };
  }
}

// ─── Storage / Sync (unchanged shape) ───
const STORAGE_KEY = "harari-dashboard-state";
async function loadState() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
async function saveState(state) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error("Storage save failed:", e); } }

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
  const payload = { description: "Harari FIRE Dashboard State", files: { [GIST_FILENAME]: { content: JSON.stringify(state, null, 2) } } };
  if (gistId) {
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${resp.statusText}`);
    return gistId;
  } else {
    const resp = await fetch("https://api.github.com/gists", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, public: false }),
    });
    if (!resp.ok) throw new Error(`GitHub ${resp.status}: ${resp.statusText}`);
    const data = await resp.json();
    return data.id;
  }
}

Object.assign(window, {
  APP_VERSION, GK_CONFIG, PHASES, BUCKET_META, TRIGGERS,
  fmtEur, fmtEurK, fmtPct, getGKZone,
  calcGKNextStep, runGKSimulation, runMonteCarlo,
  sampleReturnPath, sampleInflationPath, gaussianSample,
  deriveCashflow, nextRebalanceBucket, monthlyRecommendation,
  loadState, saveState, loadFromGist, saveToGist, GIST_FILENAME,
});

// Test harness exposure (matches original)
window.__FIRE_TESTS__ = {
  calcGKNextStep, runGKSimulation, runMonteCarlo,
  sampleReturnPath, sampleInflationPath, gaussianSample,
  GK_CONFIG, PHASES,
};
