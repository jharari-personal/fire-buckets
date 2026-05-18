// ─── Compass FIRE Planner — Engine (pure math, state shape preserved) ───

const APP_VERSION = "20260518.4";

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
  coast_fire: {
    id: "coast_fire", label: "Coast FIRE", subtitle: "Earning covers expenses — portfolio compounds",
    buckets: {
      growth:     { target: 86, range: [84,89], floor: null,  floorMonths: 0,  note: "Max growth — no withdrawals expected." },
      fortress:   { target: 6,  range: [5,7],   floor: 20000, floorMonths: 12, note: "Emergency buffer — income covers day-to-day." },
      termShield: { target: 5,  range: [3,6],   floor: 15000, floorMonths: 0,  note: "Stability anchor while compounding." },
      cash:       { target: 3,  range: [0,4],   floor: null,  floorMonths: 0,  note: "Minimal — income handles cashflow." },
    },
  },
  barista_fire: {
    id: "barista_fire", label: "Barista FIRE", subtitle: "Part-time income + small portfolio draws",
    buckets: {
      growth:     { target: 80, range: [78,83], floor: null,  floorMonths: 0,  note: "Still majority growth — draws are small." },
      fortress:   { target: 8,  range: [7,10],  floor: 25000, floorMonths: 15, note: "Larger buffer — income less reliable." },
      termShield: { target: 8,  range: [6,10],  floor: 20000, floorMonths: 0,  note: "Stability for supplemental withdrawals." },
      cash:       { target: 4,  range: [0,5],   floor: null,  floorMonths: 0,  note: "Covers months income falls short." },
    },
  },
  lean_fire: {
    id: "lean_fire", label: "Lean Independence", subtitle: "Essentials-only from portfolio",
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

// Triggers render in urgency order (immediate → week → month → quarter).
// Each trigger has a condition(state, derived) predicate. action may be a
// string or function(state, derived) → string for computed text.
const URGENCY_ORDER = { immediate: 0, week: 1, month: 2, quarter: 3 };

const TRIGGERS = [
  // ── Calendar / legal ─────────────────────────────────────────────────────
  {
    key: "ga29-dissolution",
    event: "March 2029 — 29GA dissolution deadline",
    action: "Sell 29GA on BVME.ETF via directed limit order before December 2029. Do NOT wait for the year-end deadline.",
    urgency: "immediate",
    category: "calendar",
    condition: () => new Date() < new Date("2029-10-01"),
  },
  {
    key: "art13-repeal-risk",
    event: "Art. 13 ZDDFL — CGT exemption at risk",
    action: "The 0% CGT on UCITS ETFs (VWCE, XEON) could be repealed. If a 10% rate passes, recalculate the entire withdrawal order and re-run the GK simulation with after-tax returns. Decision window: 60 days after any repeal.",
    urgency: "quarter",
    category: "tax",
    condition: () => true,
  },

  // ── Portfolio milestones ─────────────────────────────────────────────────
  {
    key: "milestone-500k",
    event: "Portfolio approaching €500k",
    action: "At €500k, split new DCA: 60% VWCE / 40% SPYI or ISAC for provider diversification. Reduces single-broker concentration risk.",
    urgency: "month",
    category: "milestone",
    condition: (_s, d) => d.portfolio >= 450_000 && d.portfolio < 525_000,
  },
  {
    key: "milestone-625k",
    event: "Portfolio approaching €625k — FIRE-ready zone",
    action: "Raise Fortress floor → €44k and TermShield → €110k (GK B1/B2 levels). Re-run full GK simulation with updated bucket balances before pulling the trigger.",
    urgency: "month",
    category: "milestone",
    condition: (_s, d) => d.portfolio >= 575_000 && d.portfolio < 650_000,
  },

  // ── Employment ───────────────────────────────────────────────────────────
  {
    key: "layoff-protocol",
    event: "Layoff confirmed",
    action: "Cancel DCA and route all surplus cash to XEON. Switch phase to Sabbatical. Do NOT sell VWCE under any circumstances. Reassess runway at 30 days.",
    urgency: "immediate",
    category: "employment",
    condition: (s) => s.currentPhase === "employed",
  },

  // ── GK guardrail warnings ────────────────────────────────────────────────
  {
    key: "gk-cut-active",
    event: "GK cut required — above Capital Preservation guardrail",
    action: (_s, d) => `WR is ${fmtPct(d.currentWR * 100)} — above the ${fmtPct(GK_CONFIG.IWR * 1.2 * 100)} guardrail. Reduce withdrawals by 10% at next year-end.`,
    urgency: "immediate",
    category: "gk",
    condition: (_s, d) => d.inDrawdown && d.currentWR >= GK_CONFIG.IWR * 1.2,
  },
  {
    key: "gk-inflation-freeze",
    event: "GK inflation raise frozen — negative return year",
    action: (_s, d) => `Last recorded return was ${d.lastReturn.toFixed(1)}%. Per Guyton-Klinger: do NOT raise withdrawals for inflation this year. Keep the same nominal withdrawal amount.`,
    urgency: "immediate",
    category: "gk",
    condition: (_s, d) => d.inDrawdown && d.lastReturn !== null && d.lastReturn < 0,
  },
  {
    key: "gk-cut-approaching",
    event: "GK Capital Preservation guardrail approaching",
    action: (_s, d) => `Current WR is ${fmtPct(d.currentWR * 100)} — approaching the ${fmtPct(GK_CONFIG.IWR * 1.2 * 100)} cut guardrail. A further portfolio decline will trigger a mandatory 10% withdrawal reduction at next year-end.`,
    urgency: "week",
    category: "gk",
    condition: (_s, d) => d.inDrawdown && d.currentWR > GK_CONFIG.IWR * 1.05 && d.currentWR < GK_CONFIG.IWR * 1.2,
  },
  {
    key: "gk-prosperity",
    event: "GK Prosperity raise available",
    action: (_s, d) => `WR is ${fmtPct(d.currentWR * 100)} — below the ${fmtPct(GK_CONFIG.IWR * 0.8 * 100)} prosperity threshold. You may raise annual withdrawals by 10% at next year-end.`,
    urgency: "month",
    category: "gk",
    condition: (_s, d) => d.inDrawdown && d.currentWR > 0 && d.currentWR < GK_CONFIG.IWR * 0.8,
  },

  // ── Sequence of Returns Risk ─────────────────────────────────────────────
  {
    key: "sorr-warning",
    event: "Sequence of Returns Risk — early drawdown loss",
    action: (_s, d) => `Portfolio down ${Math.abs(d.lastReturn).toFixed(1)}% within the first ${d.yearsInDrawdown} year(s) of drawdown. The first decade is the highest-risk window — a loss now permanently reduces long-term portfolio longevity. Draw exclusively from Cash and XEON. Do NOT sell VWCE until markets recover.`,
    urgency: "immediate",
    category: "market",
    condition: (s, d) => d.inDrawdown && d.yearsInDrawdown <= 10 && d.lastReturn !== null && d.lastReturn < -(s.sorrSeverityPct ?? 15),
  },
  {
    key: "market-drawdown",
    event: "Market drawdown — opportunistic rebalance",
    action: (_s, d) => `Last recorded return was ${d.lastReturn.toFixed(1)}%. Consider deploying strategic cash reserves into VWCE. Apply GK inflation freeze to withdrawals next year.`,
    urgency: "week",
    category: "market",
    condition: (s, d) => !d.inDrawdown && d.lastReturn !== null && d.lastReturn < -(s.sorrSeverityPct ?? 15),
  },

  // ── Bucket health ─────────────────────────────────────────────────────────
  {
    key: "cash-low",
    event: "Cash bucket critically low",
    action: (_s, d) => `Cash holds only ${d.cashMonths.toFixed(1)} months of expenses. Refill from XEON immediately — never draw on VWCE or Bonds to cover short-term liquidity needs.`,
    urgency: "immediate",
    category: "buckets",
    condition: (_s, d) => d.portfolio > 0 && d.cashMonths < 3,
  },
  {
    key: "xeon-low",
    event: "XEON (Safety) bucket below refill threshold",
    action: (_s, d) => `XEON holds ${d.xeonMonths.toFixed(1)} months of expenses — below the 6-month refill floor. Sell from Bonds (TermShield) to replenish. Do NOT touch VWCE.`,
    urgency: "week",
    category: "buckets",
    condition: (_s, d) => d.portfolio > 0 && d.xeonMonths < 6,
  },

  // ── Macro ────────────────────────────────────────────────────────────────
  {
    key: "ecb-rate-low",
    event: "XEON yield below inflation — real value erosion",
    action: (s) => `ECB deposit rate (${fmtPct(s.ecbDepositRate)}) is below your inflation assumption (${fmtPct(s.gkInflation)}%). XEON is losing real purchasing power. Consider replacing part of the Safety bucket with a short-dated EUR government bond ETF.`,
    urgency: "quarter",
    category: "market",
    condition: (s) => s.ecbDepositRate != null && s.gkInflation != null && s.ecbDepositRate < s.gkInflation,
  },

  // ── Life events ───────────────────────────────────────────────────────────
  {
    key: "daughter-school",
    event: "Daughter approaching private school age",
    action: (_s, d) => `Daughter is ${d.daughterAge} — private school costs (~€10–13k/yr) will begin soon. Add to annual expenses and recalculate GK IWR. If the revised WR exceeds ${fmtPct(GK_CONFIG.IWR * 1.2 * 100)}, a 10% withdrawal cut is already required.`,
    urgency: "month",
    category: "life",
    condition: (s, d) => s.daughterBirthYear != null && d.daughterAge !== null && d.daughterAge >= 4 && d.daughterAge <= 8,
  },
  {
    key: "pension-approaching",
    event: "State pension in ~5 years",
    action: (_s, d) => `You are ${d.age} — Bulgarian state pension eligibility is 65 (phased target by 2029 for men). In ~${65 - d.age} year(s), state benefits will reduce required portfolio draws. Recalculate your GK IWR now to model the lower post-65 withdrawal.`,
    urgency: "month",
    category: "life",
    condition: (_s, d) => d.age !== null && d.age >= 60 && d.age < 65,
  },
  {
    key: "health-insurance",
    event: "Health insurance — self-insured early retiree",
    action: (s) => `As an early retiree not covered by employment, mandatory Bulgarian health insurance (~${fmtEur(s.healthInsuranceMonthlyEUR ?? 19)}/month) must be in your essentials budget. Verify this is included in your current ${fmtEur(s.monthlyEssentialsEUR)}/month essential figure.`,
    urgency: "quarter",
    category: "life",
    condition: (_s, d) => d.inDrawdown,
  },
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

  // Dynamic guardrails: GK's 20% deviation bands scale with the chosen IWR.
  // Static 3.2 / 4.8% only hold when IWR = 4%; a 3% "Bulletproof" start would
  // immediately trigger Prosperity with the old static values.
  const dynamicUpperGuardrail = initialWR * 0.80;  // IWR − 20%
  const dynamicLowerGuardrail = initialWR * 1.20;  // IWR + 20%

  // Capital Preservation Rule fires only in the first (horizonYears − 15) years
  // per Guyton & Klinger (2006), with a crisis override: keep CPR active whenever
  // the WR is acutely elevated (> 1.5× IWR), regardless of time horizon.
  // Without the override a late-stage crash at 8%+ WR would not trigger any cut
  // in the last 15 years of a 40–50 year FIRE simulation.
  const timeConditionMet  = currentYear > horizonYears - 15;
  const crisisConditionMet = currentWR > initialWR * 1.5;
  const cprActive = !timeConditionMet || crisisConditionMet;

  if (cprActive && currentWR > dynamicLowerGuardrail) {
    finalWithdrawal = proposedWithdrawal * (1 - GK_CONFIG.ADJUSTMENT);
    trigger = "CAPITAL_PRESERVATION";
  } else if (currentWR < dynamicUpperGuardrail) {
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

// sampleCorrelatedPaths — generates a return path AND an inflation path whose
// shocks are correlated via a 3×3 Cholesky decomposition (equity, bonds, inflation).
//
// Correlations (all expressed as equity/bond return vs. inflation shock):
//   rhoEquityInflation: typically −0.3  (high inflation → lower equity real returns)
//   rhoBondInflation:   typically −0.6  (high inflation → lower bond prices via rate hike)
//
// A 2×2-only Cholesky (the old approach) treated inflation as independent, generating
// impossible regimes (12% inflation paired with +30% equities) that masked stagflation
// risk and inflated Monte Carlo success rates.
function sampleCorrelatedPaths({
  years, equityShare, equityMu, equitySigma, bondMu, bondSigma,
  rhoEquityBond = 0.0,
  inflationTarget, inflationSigma,
  rhoEquityInflation = -0.3, rhoBondInflation = -0.6,
}) {
  const equityMuArith = equityMu + (equitySigma * equitySigma) / 2;
  const bondMuArith   = bondMu   + (bondSigma   * bondSigma)   / 2;

  // 3×3 lower-triangular Cholesky: z1=equity, z2=bonds, z3=inflation
  const l11 = 1.0;
  const l21 = rhoEquityBond;
  const l22 = Math.sqrt(Math.max(0, 1 - l21 * l21));
  const l31 = rhoEquityInflation;
  const l32 = l22 > 1e-10 ? (rhoBondInflation - l31 * l21) / l22 : 0;
  const l33 = Math.sqrt(Math.max(0, 1 - l31 * l31 - l32 * l32));

  const returnPath = [];
  const inflationPath = [];
  let lastInflation = inflationTarget;

  for (let i = 0; i < years; i++) {
    const u1 = gaussianSample();
    const u2 = gaussianSample();
    const u3 = gaussianSample();

    const eqShock  = l11 * u1;
    const bdShock  = l21 * u1 + l22 * u2;
    const infShock = l31 * u1 + l32 * u2 + l33 * u3;

    const eq = equityMuArith + equitySigma * eqShock;
    const bd = bondMuArith   + bondSigma   * bdShock;
    returnPath.push(equityShare * eq + (1 - equityShare) * bd);

    // AR(1) inflation with correlated shock
    const drift = (1 - 0.85) * (inflationTarget - lastInflation);
    lastInflation = Math.max(-0.02, lastInflation + drift + inflationSigma * infShock);
    inflationPath.push(lastInflation);
  }

  return { returnPath, inflationPath };
}

function runMonteCarlo({
  startPortfolio, startWithdrawal,
  equityShare, equityMu, equitySigma, bondMu, bondSigma,
  inflationTarget, inflationSigma,
  rhoEquityBond = 0.0,
  rhoEquityInflation = -0.3,
  rhoBondInflation   = -0.6,
  years = 40, paths = 1000,
}) {
  const portfolioByYear = Array.from({ length: years }, () => []);
  let depleted = 0;
  let preservationCutCount = 0;
  const depletionYears = [];
  const terminalWealth = [];

  for (let p = 0; p < paths; p++) {
    const { returnPath, inflationPath } = sampleCorrelatedPaths({
      years, equityShare, equityMu, equitySigma, bondMu, bondSigma,
      rhoEquityBond, inflationTarget, inflationSigma,
      rhoEquityInflation, rhoBondInflation,
    });
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

// Returns { underweight, overweight }.
// - underweight: the most-pressing bucket to add money to. Floor-deficits take priority
//   over %-allocation deficits. Always non-null when portfolio > 0.
//   Shape: { key, meta, gap, current, targetEur, reason: "floor"|"target", floor,
//            floorMonths, monthsCoveredByFloor, targetPct, rangeLowerPct, rangeUpperPct }
// - overweight: the most-overweight bucket above its range upper, or null if all within
//   tolerance. Tolerance = 0.5% of portfolio (avoids flagging rounding-level drift).
//   Shape: { key, meta, excess, current, rangeUpperEur, rangeUpperPct, targetPct }
function nextRebalanceBucket(state) {
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  if (portfolio <= 0) {
    return {
      underweight: { key: "growth", meta: BUCKET_META.growth, gap: 0, current: 0, targetEur: 0, reason: "target", floor: 0, floorMonths: 0, targetPct: 0 },
      overweight: null,
    };
  }
  const phase = PHASES[state.currentPhase] || PHASES.employed;
  const cf = deriveCashflow(state);
  const map = [
    { key: "growth",     stateKey: "bucketVWCE",        meta: BUCKET_META.growth },
    { key: "fortress",   stateKey: "bucketXEON",        meta: BUCKET_META.fortress },
    { key: "termShield", stateKey: "bucketFixedIncome", meta: BUCKET_META.termShield },
    { key: "cash",       stateKey: "bucketCash",        meta: BUCKET_META.cash },
  ];
  const items = map.map(b => {
    const cfg = phase.buckets[b.key];
    const cur = state[b.stateKey] || 0;
    const targetPct = cfg.target;
    const target = targetPct / 100;
    const targetEur = portfolio * target;
    const floor = effectiveFloor(cfg, cf.totalExpenses);
    const floorMonths = cfg.floorMonths || 0;
    const floorGap = Math.max(0, floor - cur);
    const pctGap = Math.max(0, targetEur - cur);
    const rangeLowerPct = (cfg.range && cfg.range[0]) || 0;
    const rangeUpperPct = (cfg.range && cfg.range[1]) || 100;
    const rangeUpperEur = portfolio * rangeUpperPct / 100;
    const excess = cur - rangeUpperEur;
    return { ...b, cur, targetPct, targetEur, floor, floorMonths, floorGap, pctGap, rangeLowerPct, rangeUpperPct, rangeUpperEur, excess };
  });

  const belowFloor = items.filter(i => i.floorGap > 0).sort((a, b) => b.floorGap - a.floorGap);
  let underweight;
  if (belowFloor.length > 0) {
    const w = belowFloor[0];
    underweight = {
      key: w.key, meta: w.meta, gap: w.floorGap, current: w.cur, targetEur: w.floor,
      reason: "floor", floor: w.floor, floorMonths: w.floorMonths, targetPct: w.targetPct,
      rangeLowerPct: w.rangeLowerPct, rangeUpperPct: w.rangeUpperPct,
    };
  } else {
    const w = items.slice().sort((a, b) => b.pctGap - a.pctGap)[0];
    underweight = {
      key: w.key, meta: w.meta, gap: w.pctGap, current: w.cur, targetEur: w.targetEur,
      reason: "target", floor: w.floor, floorMonths: w.floorMonths, targetPct: w.targetPct,
      rangeLowerPct: w.rangeLowerPct, rangeUpperPct: w.rangeUpperPct,
    };
  }

  const tolerance = portfolio * 0.005; // 0.5% of portfolio
  const over = items
    .filter(i => i.excess > tolerance && i.key !== underweight.key)
    .sort((a, b) => b.excess - a.excess)[0];
  const overweight = over ? {
    key: over.key, meta: over.meta, excess: over.excess, current: over.cur,
    rangeUpperEur: over.rangeUpperEur, rangeUpperPct: over.rangeUpperPct, targetPct: over.targetPct,
  } : null;

  return { underweight, overweight };
}

// Returns the most recent finalWithdrawal, or 0 when accumulating (positive surplus + no
// history), or forecast annualExpenses when actually drawing. Replaces the unconditional
// `annualExpenses` fallback that produced phantom WR while employed.
function effectiveLastWithdrawal(state) {
  if (state.gkHistory && state.gkHistory.length > 0) {
    return state.gkHistory[state.gkHistory.length - 1].finalWithdrawal;
  }
  const cf = deriveCashflow(state);
  return cf.surplusMonthly >= 0 ? 0 : cf.annualExpenses;
}

// Returns a structured monthly action plan. Three modes:
//   - "accumulating" — surplus > 0 and either no GK history or still in an earning phase.
//     WR/zone are display-only, no fun-budget holdback. primary.verb = "Invest".
//   - "lean_drawdown" — small shortfall fully covered by trimming the fun budget.
//     primary.verb = "Trim fun". No sell required.
//   - "shortfall" — shortfall exceeds fun budget. primary.verb = "Withdraw" with the
//     cascade source (Cash → XEON → Bonds → VWCE).
const ACCUMULATING_PHASES = new Set(["employed", "coast_fire", "barista_fire"]);

function monthlyOutlook(state) {
  const cf = deriveCashflow(state);
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  const fireTarget = cf.annualExpenses / GK_CONFIG.IWR;
  const lastWithdrawal = effectiveLastWithdrawal(state);
  const wr = portfolio > 0 ? (lastWithdrawal / portfolio) * 100 : 0;
  const zone = getGKZone(wr);
  const rebalance = nextRebalanceBucket(state);

  const monthsOf = (eur) => cf.totalExpenses > 0 ? (eur / cf.totalExpenses) : 0;

  const buildOverweightSecondary = () => {
    if (!rebalance.overweight) return null;
    const o = rebalance.overweight;
    return {
      type: "rebalance_out",
      fromKey: o.key,
      fromMeta: o.meta,
      toKey: rebalance.underweight.key,
      toMeta: rebalance.underweight.meta,
      excessEur: Math.round(o.excess),
      rangeUpperPct: o.rangeUpperPct,
      targetPct: o.targetPct,
    };
  };

  // ─── Accumulating mode ───────────────────────────────────────────────
  const isAccumulating =
    cf.surplusMonthly >= 0 &&
    ((state.gkHistory || []).length === 0 || ACCUMULATING_PHASES.has(state.currentPhase));

  if (isAccumulating) {
    const u = rebalance.underweight;
    const amount = Math.max(0, Math.round(cf.surplusMonthly));
    const afterBalance = u.current + amount;
    const reason = {
      type: u.reason, // "floor" | "target"
      gap: Math.round(u.gap),
      floorEur: u.floor,
      floorMonths: u.floorMonths,
      targetPct: u.targetPct,
      rangeLowerPct: u.rangeLowerPct,
      rangeUpperPct: u.rangeUpperPct,
      afterBalance,
      afterMonths: monthsOf(afterBalance),
      currentMonths: monthsOf(u.current),
    };

    const secondary = [];
    const ow = buildOverweightSecondary();
    if (ow) secondary.push(ow);

    const subtitle = u.reason === "floor"
      ? `${fmtEur(u.gap)} short of your ${u.floorMonths}-month safety floor.`
      : (u.gap > 0
          ? `${fmtEur(u.gap)} below ${u.targetPct}% target.`
          : `All buckets in range — continue compounding.`);

    return {
      mode: "accumulating",
      cf, portfolio, fireTarget, zone, wr,
      primary: {
        verb: "Invest", amount,
        bucketKey: u.key, meta: u.meta, reason,
      },
      secondary,
      floorContext: u.reason === "floor" ? {
        bucketKey: u.key, meta: u.meta,
        current: u.current, floor: u.floor, gap: u.gap, months: u.floorMonths,
        currentMonths: monthsOf(u.current),
      } : null,
      headline: amount > 0
        ? `Invest ${fmtEur(amount)} into ${u.meta.label} (${u.meta.inst})`
        : `Balanced — no action needed`,
      subtitle,
      // Back-compat aliases for any caller still using monthlyRecommendation shape
      need: { key: u.key, meta: u.meta, gap: u.gap, reason: u.reason },
      transfer: amount, funKept: cf.fun, funCut: 0,
      tone: "good",
    };
  }

  // ─── Drawdown branches ──────────────────────────────────────────────
  const shortfall = -cf.surplusMonthly;
  const funCut = Math.min(cf.fun, shortfall);
  const drawNeeded = Math.max(0, shortfall - funCut);

  // Lean drawdown: fun budget alone covers it
  if (drawNeeded === 0) {
    const secondary = [];
    const ow = buildOverweightSecondary();
    if (ow) secondary.push(ow);
    return {
      mode: "lean_drawdown",
      cf, portfolio, fireTarget, zone, wr,
      primary: {
        verb: "Trim fun", amount: Math.round(funCut),
        bucketKey: null, meta: null,
        reason: { type: "fun_covers", funCutEur: Math.round(funCut), funBefore: cf.fun, funAfter: cf.fun - funCut },
      },
      secondary,
      floorContext: null,
      headline: `Trim fun by ${fmtEur(funCut)} — no withdrawal needed`,
      subtitle: `Income falls short by ${fmtEur(shortfall)} but the fun budget absorbs it.`,
      // Back-compat
      drawNeeded: 0, drawSource: null, drawSourceLabel: null, drawSourceInst: null,
      shortfall, funKept: Math.max(0, cf.fun - funCut), funCut, xeonWarning: false, cgtCost: 0,
      tone: "warn",
    };
  }

  // Full shortfall — cascade
  const xeonBal  = state.bucketXEON        || 0;
  const bondsBal = state.bucketFixedIncome || 0;
  const cashBal  = state.bucketCash        || 0;

  let drawKey, drawSource, drawSourceLabel, drawSourceInst, drawMeta;
  let xeonWarning = false;
  if (cashBal >= drawNeeded) {
    drawKey = "cash"; drawSource = "cash"; drawSourceLabel = "Cash"; drawSourceInst = "EUR cash";
    drawMeta = BUCKET_META.cash;
  } else if (xeonBal > 0) {
    drawKey = "fortress"; drawSource = "fortress"; drawSourceLabel = "Safety"; drawSourceInst = "XEON";
    drawMeta = BUCKET_META.fortress;
    if (xeonBal < drawNeeded * 2) xeonWarning = true;
  } else if (bondsBal > 0) {
    drawKey = "termShield"; drawSource = "termShield"; drawSourceLabel = "Stability"; drawSourceInst = "Bonds";
    drawMeta = BUCKET_META.termShield;
  } else {
    drawKey = "growth"; drawSource = "growth"; drawSourceLabel = "Growth (last resort)"; drawSourceInst = "VWCE";
    drawMeta = BUCKET_META.growth;
  }

  const cgtRate = (state.bgCgtRatePct || 10) / 100;
  const gainsFraction = 0.5;
  const cgtCost = drawSource === "growth" ? Math.round(drawNeeded * gainsFraction * cgtRate) : 0;

  const secondary = [];
  if (funCut > 0) {
    secondary.push({ type: "fun_trim", funCutEur: Math.round(funCut), funBefore: cf.fun, funAfter: cf.fun - funCut });
  }
  if (xeonWarning) {
    secondary.push({ type: "xeon_low", currentXeon: xeonBal, drawNeeded: Math.round(drawNeeded), monthsLeft: monthsOf(xeonBal) });
  }
  if (cgtCost > 0) {
    secondary.push({ type: "cgt", costEur: cgtCost, ratePct: (state.bgCgtRatePct || 10) });
  }
  const ow = buildOverweightSecondary();
  if (ow) secondary.push(ow);

  return {
    mode: "shortfall",
    cf, portfolio, fireTarget, zone, wr,
    primary: {
      verb: "Withdraw", amount: Math.round(drawNeeded),
      bucketKey: drawKey, meta: drawMeta,
      reason: {
        type: "cascade",
        source: drawSource,
        cashBal, xeonBal, bondsBal,
        funCutEur: Math.round(funCut),
        afterBalance: (drawSource === "cash" ? cashBal : drawSource === "fortress" ? xeonBal : drawSource === "termShield" ? bondsBal : 0) - drawNeeded,
      },
    },
    secondary,
    floorContext: null,
    headline: `Withdraw ${fmtEur(drawNeeded)} from ${drawSourceLabel} (${drawSourceInst})`,
    subtitle: `WR ${wr.toFixed(2)}% — ${zone.label}.`,
    // Back-compat
    drawNeeded, drawSource, drawSourceLabel, drawSourceInst,
    shortfall, funKept: Math.max(0, cf.fun - funCut), funCut, xeonWarning, cgtCost,
    tone: drawSource === "growth" ? "bad" : "warn",
  };
}

// Back-compat alias — keep `monthlyRecommendation` exported with the same flat shape
// (mode === "surplus" was the legacy name for accumulating; map it back here).
function monthlyRecommendation(state) {
  const o = monthlyOutlook(state);
  const mode = o.mode === "accumulating" ? "surplus" : "shortfall";
  return { ...o, mode };
}

// ─── Trigger evaluation ───
// Computes all derived values needed by trigger conditions, then returns the
// filtered, action-resolved, urgency-sorted list of active triggers.
function evaluateTriggers(state) {
  const cf = deriveCashflow(state);
  const portfolio = (state.bucketVWCE || 0) + (state.bucketXEON || 0) + (state.bucketFixedIncome || 0) + (state.bucketCash || 0);
  const inDrawdown = state.currentPhase === "lean_fire" || state.currentPhase === "full_fire";
  const sortedHistory = (state.gkHistory || []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const lastHistory = sortedHistory[0] ?? null;
  const lastReturn = lastHistory ? (lastHistory.actualReturn ?? null) : null;
  const currentWR = lastHistory?.wr
    ?? (inDrawdown && portfolio > 0 ? cf.annualExpenses / portfolio : 0);
  const currentYear = new Date().getFullYear();
  const age = state.userBirthYear ? currentYear - state.userBirthYear : null;
  const daughterAge = state.daughterBirthYear ? currentYear - state.daughterBirthYear : null;
  const cashMonths = cf.totalExpenses > 0 ? (state.bucketCash || 0) / cf.totalExpenses : 0;
  const xeonMonths = cf.totalExpenses > 0 ? (state.bucketXEON || 0) / cf.totalExpenses : 0;
  const yearsInDrawdown = inDrawdown ? sortedHistory.length : 0;

  const derived = { portfolio, inDrawdown, lastReturn, currentWR, age, daughterAge, cashMonths, xeonMonths, yearsInDrawdown };

  return TRIGGERS
    .filter(t => { try { return t.condition(state, derived); } catch { return false; } })
    .map(t => ({ ...t, action: typeof t.action === "function" ? t.action(state, derived) : t.action }))
    .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 99) - (URGENCY_ORDER[b.urgency] ?? 99));
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
  const OMIT_KEYS = new Set(["cloudToken"]);
  const content = JSON.stringify(state, (k, v) => (k !== "" && OMIT_KEYS.has(k)) ? undefined : v, 2);
  const payload = { description: "Harari FIRE Dashboard State", files: { [GIST_FILENAME]: { content } } };
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

function monthsToTarget(portfolio, target, monthlySurplus, realReturnMonthly) {
  if (portfolio >= target) return 0;
  if (monthlySurplus <= 0 && realReturnMonthly <= 0) return Infinity;
  if (monthlySurplus <= 0) {
    const n = Math.log(target / portfolio) / Math.log(1 + realReturnMonthly);
    return n > 600 ? Infinity : Math.ceil(n);
  }
  const r = realReturnMonthly;
  const c = monthlySurplus;
  if (r === 0) return Math.ceil((target - portfolio) / c);
  const numerator   = target    * r + c;
  const denominator = portfolio * r + c;
  if (denominator <= 0 || numerator <= 0) return Infinity;
  const n = Math.log(numerator / denominator) / Math.log(1 + r);
  return Number.isFinite(n) && n > 0 && n <= 600 ? Math.ceil(n) : Infinity;
}

Object.assign(window, {
  APP_VERSION, GK_CONFIG, PHASES, BUCKET_META, TRIGGERS, URGENCY_ORDER,
  fmtEur, fmtEurK, fmtPct, getGKZone,
  calcGKNextStep, runGKSimulation, runMonteCarlo,
  sampleCorrelatedPaths, sampleReturnPath, sampleInflationPath, gaussianSample,
  deriveCashflow, nextRebalanceBucket, monthlyRecommendation, monthlyOutlook,
  effectiveFloor, effectiveLastWithdrawal,
  evaluateTriggers, monthsToTarget,
  loadState, saveState, loadFromGist, saveToGist, GIST_FILENAME,
});

window.__FIRE_TESTS__ = {
  calcGKNextStep, runGKSimulation, runMonteCarlo,
  sampleCorrelatedPaths, sampleReturnPath, sampleInflationPath, gaussianSample,
  GK_CONFIG, PHASES,
};
