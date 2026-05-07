// ─── Compass FIRE Planner — Engine (pure math, state shape preserved) ───

const APP_VERSION = "20260507.0";

const GK_CONFIG = {
  IWR: 0.04,
  UPPER_GUARDRAIL: 0.032,
  LOWER_GUARDRAIL: 0.048,
  ADJUSTMENT: 0.10,
  // No INFLATION_CAP — canonical Guyton-Klinger 2006 applies the full CPI raise.
  // The previous 6% cap silently destroyed real purchasing power in elevated-inflation
  // regimes (e.g. Eurozone HICP hit 10.6% in Oct 2022; the cap produced a −4.2% real cut).
};

const fmtEur = (n) => `€${Math.round(Number(n) || 0).toLocaleString("en-GB")}`;
const fmtEurK = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `€${(v/1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000)     return `€${Math.round(v/1000)}k`;
  return `€${Math.round(v)}`;
};
const fmtPct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

function getGKZone(wr) {
  if (wr <= 0)                                  return { id: "covered",    label: "Covered",    tone: "good",   color: "var(--good)"   };
  if (wr > GK_CONFIG.LOWER_GUARDRAIL * 100)     return { id: "cut",        label: "Cut zone",   tone: "bad",    color: "var(--bad)"    };
  if (wr > GK_CONFIG.IWR * 100)                 return { id: "elevated",   label: "Elevated",   tone: "warn",   color: "var(--warn)"   };
  if (wr > GK_CONFIG.UPPER_GUARDRAIL * 100)     return { id: "safe",       label: "Safe",       tone: "good",   color: "var(--good)"   };
  return                                               { id: "prosperity", label: "Prosperity", tone: "accent", color: "var(--accent)" };
}

// floorMonths: number of months of total expenses that define the expense-linked floor.
// The effective floor is max(static floor, floorMonths × monthlyTotal).
const PHASES = {
  employed: {
    id: "employed", label: "Employed", subtitle: "Accumulating — salary flowing",
    buckets: {
      growth:     { target: 84, range: [82,87], floor: null,  floorMonths: 0,  note: "VWCE core. Single provider OK below €500k." },
      fortress:   { target: 7,  range: [6,8],   floor: 30000, floorMonths: 18, note: "~16–18 months expenses. Draw first if laid off." },
      termShield: { target: 5,  range: [4,6],   floor: 18000, floorMonths: 0,  note: "29GA until Q1 2029, then reassess instrument." },
      cash:       { target: 4,  range: [0,5],   floor: null,  floorMonths: 0,  note: "DCA deployment buffer — drive toward 0%." },
    },
  },
  laid_off: {
    id: "laid_off", label: "Sabbatical", subtitle: "No income — fortress mode",
    buckets: {
      growth:     { target: 82, range: [78,85], floor: null,  floorMonths: 0,  note: "Do not sell. Freeze. Let it compound." },
      fortress:   { target: 10, range: [8,12],  floor: 35000, floorMonths: 18, note: "Severance lands here. Draw first." },
      termShield: { target: 5,  range: [4,7],   floor: 18000, floorMonths: 0,  note: "Draw second, after fortress depleted." },
      cash:       { target: 3,  range: [1,5],   floor: null,  floorMonths: 0,  note: "Severance overflow + operating liquidity." },
    },
  },
  lean_fire: {
    id: "lean_fire", label: "Lean FIRE", subtitle: "Part-time income + portfolio growth",
    buckets: {
      growth:     { target: 78, range: [72,82], floor: null,  floorMonths: 0,  note: "Multi-provider above €500k." },
      fortress:   { target: 8,  range: [6,12],  floor: 40000, floorMonths: 24, note: "GK B1 — 2yr safety net. Draw first." },
      termShield: { target: 10, range: [8,14],  floor: 55000, floorMonths: 36, note: "GK B2 partial. Roll toward 5yr target." },
      cash:       { target: 4,  range: [2,5],   floor: null,  floorMonths: 0,  note: "Operating buffer + opportunity fund." },
    },
  },
  full_fire: {
    id: "full_fire", label: "Full FIRE", subtitle: "Living off the portfolio",
    buckets: {
      growth:     { target: 72, range: [65,78], floor: null,   floorMonths: 0,  note: "Multi-provider mandatory. Rebalance annually." },
      fortress:   { target: 8,  range: [6,12],  floor: 44000,  floorMonths: 24, note: "GK B1 — 2yr expenses. Refill from B2." },
      termShield: { target: 16, range: [12,20], floor: 110000, floorMonths: 60, note: "GK B2 — 5yr expenses. Refill B1." },
      cash:       { target: 4,  range: [2,6],   floor: null,   floorMonths: 0,  note: "3–6 months immediate liquidity." },
    },
  },
};

const BUCKET_META = {
  growth:     { label: "Growth",    sub: "VWCE",             inst: "VWCE",     color: "var(--b-growth)",   raw: "#7aa2ff", short: "Compounding machine. Never sell in drawdowns." },
  fortress:   { label: "Safety",    sub: "XEON (€STR)",      inst: "XEON",     color: "var(--b-fortress)", raw: "#6cd49a", short: "GK B1 — 2yr liquidity. Layoff runway." },
  termShield: { label: "Stability", sub: "Bonds / Bond ETF", inst: "Bonds",    color: "var(--b-fixed)",    raw: "#f5b86b", short: "GK B2 — 5yr stability. Refill Safety." },
  cash:       { label: "Cash",      sub: "EUR @ IBKR",       inst: "EUR cash", color: "var(--b-cash)",     raw: "#8c8c87", short: "DCA buffer or opportunity fund." },
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

// ─── GK Calculation Engine ───
//
// Changes vs. prior version:
//   1. No inflation cap — canonical GK 2006 applies the full CPI adjustment.
//   2. Year-1 fix: firstYear=true skips the inflation raise (GK says inflate *last year's*
//      withdrawal; in year 1 there is no last year, so startWithdrawal IS year-1's amount).
//   3. CPR (Capital Preservation Rule) is disabled in the last 15 years of the planning
//      horizon, per Guyton & Klinger (2006) Table 5 rationale.
function calcGKNextStep({
  portfolio, lastWithdrawal, annualNominalReturn, inflation,
  initialWR = GK_CONFIG.IWR,
  firstYear = false,
  currentYear = 1,
  horizonYears = 40,
}) {
  if (portfolio <= 0) return { proposedWithdrawal: 0, finalWithdrawal: 0, trigger: "DEPLETED", wr: 0 };

  let proposedWithdrawal = lastWithdrawal;
  const currentWRPreRaise = lastWithdrawal / portfolio;
  // Skip inflation raise in year 1 (no prior year) OR when GK's two-condition gate fires:
  //   prior return < 0 AND current pre-raise WR > IWR.
  const skipInflationRaise = firstYear || (annualNominalReturn < 0 && currentWRPreRaise > initialWR);
  if (!skipInflationRaise) {
    proposedWithdrawal = lastWithdrawal * (1 + inflation);
  }

  const currentWR = proposedWithdrawal / portfolio;
  let trigger = null;
  let finalWithdrawal = proposedWithdrawal;

  // Capital Preservation Rule fires only in the first (horizonYears − 15) years.
  const cprActive = currentYear <= horizonYears - 15;
  if (cprActive && currentWR > GK_CONFIG.LOWER_GUARDRAIL) {
    finalWithdrawal = proposedWithdrawal * (1 - GK_CONFIG.ADJUSTMENT);
    trigger = "CAPITAL_PRESERVATION";
  } else if (currentWR < GK_CONFIG.UPPER_GUARDRAIL) {
    finalWithdrawal = proposedWithdrawal * (1 + GK_CONFIG.ADJUSTMENT);
    trigger = "PROSPERITY";
  }
  return { proposedWithdrawal, finalWithdrawal, trigger, wr: finalWithdrawal / portfolio };
}

function runGKSimulation({
  startPortfolio, startWithdrawal, nominalReturn, inflation,
  returnPath, inflationPath, years = 40, initialWR,
}) {
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
      firstYear: year === 1, currentYear: year, horizonYears: years,
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

// Box-Muller — returns one N(0,1) sample. Both the sin and cos are valid; we
// store the second in a module-level slot to halve Math.random() calls.
let _gaussianSpare = null;
let _gaussianHasSpare = false;
function gaussianSample() {
  if (_gaussianHasSpare) { _gaussianHasSpare = false; return _gaussianSpare; }
  let u = 0;
  while (u === 0) u = Math.random();
  const v = Math.random();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  const angle = 2.0 * Math.PI * v;
  _gaussianSpare = mag * Math.sin(angle);
  _gaussianHasSpare = true;
  return mag * Math.cos(angle);
}

// sampleReturnPath — bivariate correlated return path.
//
// equityMu / bondMu are interpreted as *geometric* means (what users report from
// historical CAGR data). We convert to arithmetic before drawing normal shocks:
//   μ_arith = μ_geo + σ²/2   (Jensen's inequality / volatility drag correction)
//
// Equity and bond shocks are correlated via Cholesky decomposition:
//   eq_shock = z1
//   bd_shock = ρ·z1 + √(1−ρ²)·z2
// rhoEquityBond defaults to 0 (independence); pass a positive value (e.g. 0.3–0.5)
// to model inflation-regime drawdowns where stocks and bonds fall together.
function sampleReturnPath({
  years, equityShare, equityMu, equitySigma, bondMu, bondSigma, rhoEquityBond = 0.0,
}) {
  const equityMuArith = equityMu + (equitySigma * equitySigma) / 2;
  const bondMuArith   = bondMu   + (bondSigma   * bondSigma)   / 2;
  const sqrtOneMinusRho2 = Math.sqrt(Math.max(0, 1 - rhoEquityBond * rhoEquityBond));
  const path = [];
  for (let i = 0; i < years; i++) {
    const z1 = gaussianSample();
    const z2 = gaussianSample();
    const eqShock = z1;
    const bdShock = rhoEquityBond * z1 + sqrtOneMinusRho2 * z2;
    const eq = equityMuArith + equitySigma * eqShock;
    const bd = bondMuArith   + bondSigma   * bdShock;
    path.push(equityShare * eq + (1 - equityShare) * bd);
  }
  return path;
}

// sampleInflationPath — AR(1) with φ=0.85 persistence.
// Prior version used φ=0.4, which caused multi-year inflation regimes (e.g. 1973–82)
// to be statistically impossible — any 5%-above-target shock collapsed in one year.
// Real-world annual CPI autocorrelation is φ≈0.85; this value reproduces it.
function sampleInflationPath({ years, target, sigma }) {
  const path = [];
  let last = target;
  for (let i = 0; i < years; i++) {
    const drift = (1 - 0.85) * (target - last);
    const shock = sigma * gaussianSample();
    last = Math.max(-0.02, last + drift + shock);
    path.push(last);
  }
  return path;
}

function runMonteCarlo({
  startPortfolio, startWithdrawal,
  equityShare, equityMu, equitySigma, bondMu, bondSigma,
  inflationTarget, inflationSigma,
  rhoEquityBond = 0.0,
  years = 40, paths = 1000,
}) {
  const portfolioByYear = Array.from({ length: years }, () => []);
  let depleted = 0;
  let preservationCutCount = 0;
  const depletionYears = [];
  const terminalWealth = [];

  for (let p = 0; p < paths; p++) {
    const returnPath = sampleReturnPath({
      years, equityShare, equityMu, equitySigma, bondMu, bondSigma, rhoEquityBond,
    });
    const inflationPath = sampleInflationPath({ years, target: inflationTarget, sigma: inflationSigma });
    const rows = runGKSimulation({ startPortfolio, startWithdrawal, returnPath, inflationPath, years });

    let cutEarly = false;
    for (let y = 0; y < years; y++) {
      const row = rows[y];
      portfolioByYear[y].push(row ? row.portfolioEnd : 0);
      if (row && row.trigger === "CAPITAL_PRESERVATION" && y < 10) cutEarly = true;
    }
    const endBalance = rows.length > 0 ? rows[rows.length - 1].portfolioEnd : 0;
    const pathDepleted = rows.length < years || endBalance <= 0;
    if (pathDepleted) {
      depleted++;
      depletionYears.push(rows.length);
    }
    terminalWealth.push(pathDepleted ? 0 : endBalance);
    if (cutEarly) preservationCutCount++;
  }

  // Linear-interpolation percentile (smoother than nearest-rank, especially for <500 paths)
  const pct = (arr, q) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = q * (sorted.length - 1);
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };

  const bands = portfolioByYear.map((vals, i) => ({
    year: i + 1,
    p10: pct(vals, 0.10), p25: pct(vals, 0.25),
    p50: pct(vals, 0.50),
    p75: pct(vals, 0.75), p90: pct(vals, 0.90),
  }));

  // CVaR: mean terminal wealth in the worst 10% of paths
  const p10count = Math.max(1, Math.floor(paths * 0.10));
  const sortedWealth = [...terminalWealth].sort((a, b) => a - b);
  const cvar10 = sortedWealth.slice(0, p10count).reduce((s, v) => s + v, 0) / p10count;

  // Median depletion year (for failed paths)
  const medianDepletionYear = depleted > 0
    ? depletionYears.slice().sort((a, b) => a - b)[Math.floor(depletionYears.length / 2)]
    : null;

  return {
    bands,
    successRate: 1 - depleted / paths,
    preservationCutRate: preservationCutCount / paths,
    cvar10,
    medianDepletionYear,
    paths,
  };
}

// ─── Derived cashflow + monthly recommendation ───
function deriveCashflow(state) {
  const phase = PHASES[state.currentPhase] || PHASES.employed;
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

// Compute the effective floor for a bucket, combining static EUR floor and expense-linked floor.
function effectiveFloor(bucketCfg, monthlyTotal) {
  const staticFloor = bucketCfg.floor || 0;
  const dynFloor    = (bucketCfg.floorMonths || 0) * monthlyTotal;
  return Math.max(staticFloor, dynFloor);
}

function nextRebalanceBucket(state) {
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  if (portfolio <= 0) return { key: "growth", meta: BUCKET_META.growth, gap: 0, current: 0, targetEur: 0 };
  const phase = PHASES[state.currentPhase] || PHASES.employed;
  const cf = deriveCashflow(state);
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
    const floor = effectiveFloor(phase.buckets[b.key], cf.totalExpenses);
    const floorGap = Math.max(0, floor - cur);
    const pctGap = Math.max(0, targetEur - cur);
    return { ...b, cur, target, targetEur, floor, floorGap, pctGap };
  });
  const belowFloor = items.filter(i => i.floorGap > 0).sort((a, b) => b.floorGap - a.floorGap);
  if (belowFloor.length > 0) {
    const w = belowFloor[0];
    return { key: w.key, meta: w.meta, gap: w.floorGap, current: w.cur, targetEur: w.floor, reason: "floor" };
  }
  const sorted = items.slice().sort((a, b) => b.pctGap - a.pctGap);
  const w = sorted[0];
  return { key: w.key, meta: w.meta, gap: w.pctGap, current: w.cur, targetEur: w.targetEur, reason: "target" };
}

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
    const need = nextRebalanceBucket(state);
    const holdBackPctOfFun =
      zone.id === "cut"        ? 0.50 :
      zone.id === "elevated"   ? 0.20 :
      zone.id === "prosperity" ? 0    :
                                  0.10;
    const funCut = Math.round(cf.fun * holdBackPctOfFun);
    const transfer = Math.max(0, cf.surplusMonthly + funCut);
    return {
      mode: "surplus", zone, cf, need, fireTarget,
      transfer, funKept: cf.fun - funCut, funCut,
      headline: `Transfer ${fmtEur(transfer)} to ${need.meta.label} (${need.meta.inst})`,
      tone: "good",
    };
  } else {
    const shortfall = -cf.surplusMonthly;
    const funCut = Math.min(cf.fun, shortfall);
    const drawNeeded = Math.max(0, shortfall - funCut);

    // Cascade draw sources: Cash → Safety (XEON) → Stability (Bonds) → Growth (last resort).
    // Never hardcode "draw from XEON" — check actual balances first.
    const xeonBal  = state.bucketXEON        || 0;
    const bondsBal = state.bucketFixedIncome || 0;
    const cashBal  = state.bucketCash        || 0;

    let drawSource, drawSourceLabel, drawSourceInst;
    let xeonWarning = false;

    if (cashBal >= drawNeeded && drawNeeded > 0) {
      drawSource = "cash"; drawSourceLabel = "Cash"; drawSourceInst = "EUR cash";
    } else if (xeonBal > 0) {
      drawSource = "fortress"; drawSourceLabel = "Safety"; drawSourceInst = "XEON";
      // Warn when XEON is running thin (< 2 months of draw left)
      if (xeonBal < drawNeeded * 2) xeonWarning = true;
    } else if (bondsBal > 0) {
      drawSource = "termShield"; drawSourceLabel = "Stability"; drawSourceInst = "Bonds";
    } else {
      drawSource = "growth"; drawSourceLabel = "Growth (last resort)"; drawSourceInst = "VWCE";
    }

    // Estimated CGT cost if forced to draw from VWCE (assumes 50% gain fraction when no costBasis)
    const cgtRate = (state.bgCgtRatePct || 10) / 100;
    const gainsFraction = 0.5;
    const cgtCost = drawSource === "growth" ? Math.round(drawNeeded * gainsFraction * cgtRate) : 0;

    return {
      mode: "shortfall", zone, cf, fireTarget,
      shortfall, funKept: Math.max(0, cf.fun - funCut), funCut, drawNeeded,
      drawSource, drawSourceLabel, drawSourceInst, xeonWarning, cgtCost,
      headline: drawNeeded > 0
        ? `Withdraw ${fmtEur(drawNeeded)} from ${drawSourceLabel} (${drawSourceInst}) this month`
        : `Tighten fun budget by ${fmtEur(funCut)} — no withdrawal needed`,
      tone: drawSource === "growth" ? "bad" : "warn",
    };
  }
}

// ─── Storage / Sync ───
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
  deriveCashflow, nextRebalanceBucket, monthlyRecommendation, effectiveFloor,
  loadState, saveState, loadFromGist, saveToGist, GIST_FILENAME,
});

window.__FIRE_TESTS__ = {
  calcGKNextStep, runGKSimulation, runMonteCarlo,
  sampleReturnPath, sampleInflationPath, gaussianSample,
  GK_CONFIG, PHASES,
};
