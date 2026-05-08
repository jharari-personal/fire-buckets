# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Compass** — a single-user personal financial planning PWA for managing a FIRE (Financial Independence, Retire Early) strategy. Uses React 18 (via CDN) with Babel for client-side transpilation. No build step, no npm, no bundler.

The app is split across several `<script type="text/babel">` files loaded in order by `index.html`. All inter-file communication happens via `window` globals (each file does `Object.assign(window, {...})` or `window.FooView = FooView` at the bottom).

## File Structure

| File | Purpose |
|------|---------|
| `engine.js` | Constants, GK math engine, Monte Carlo, cashflow helpers, storage |
| `ui.js` | Design-system primitives (components, hooks) |
| `today.js` | **Today** tab — situational awareness |
| `plan.js` | **Plan** tab — bucket balances, cashflow inputs |
| `stress.js` | **Stress** tab — linear projection + Monte Carlo |
| `history.js` | **History** tab — annual GK log |
| `script.js` | App shell — `SettingsSheet`, `Header`, `App` root, `ReactDOM.createRoot` |
| `sw.js` | Service Worker (stale-while-revalidate) |

Load order in `index.html`: `engine.js` → `ui.js` → `today.js` → `plan.js` → `stress.js` → `history.js` → `script.js`.

## Deployment

Push to `main` → auto-deploys to GitHub Pages. `.nojekyll` disables Jekyll so static files are served as-is.

**After any change, bump `APP_VERSION` in `engine.js` AND `SW_VERSION` in `sw.js`** (format: `YYYYMMDD.N`, e.g. `"20260508.0"`). The two strings must stay in sync — they live in separate execution contexts. Bumping only one does not invalidate the cache.

## GitHub CLI

`gh` is not in the PATH of the non-interactive shell. Always call it by full path:

```
"C:\Program Files\GitHub CLI\gh.exe"
```

## Architecture

### `engine.js` — Constants & pure math

**Constants:**
- `GK_CONFIG` — Guyton-Klinger parameters: `IWR` 4.0%, `UPPER_GUARDRAIL` 3.2%, `LOWER_GUARDRAIL` 4.8%, `ADJUSTMENT` 10%. No inflation cap — canonical GK 2006 applies the full CPI adjustment (the old 6% cap silently destroyed real purchasing power in 2022).
- `PHASES` — 4 life phases (`employed`, `laid_off`, `lean_fire`, `full_fire`), each with bucket allocation `target`, `range`, `floor`, and `floorMonths`. The effective floor is `max(staticFloor, floorMonths × monthlyTotal)`.
- `BUCKET_META` — display metadata for the 4 buckets: `growth` (VWCE), `fortress` (XEON), `termShield` (Bonds), `cash` (EUR cash).
- `TRIGGERS` — 10 event-driven decision rules with urgency levels.
- `fmtEur(n)` / `fmtEurK(n)` / `fmtPct(n)` — number formatters.

**GK Engine:**
- `calcGKNextStep({ portfolio, lastWithdrawal, annualNominalReturn, inflation, initialWR, firstYear, currentYear, horizonYears })` — applies GK rules in sequence:
  1. **Inflation Rule** — raise by CPI, **skip iff** `firstYear` OR (prior return < 0 AND pre-raise WR > `initialWR`).
  2. **Capital Preservation Rule** — cut 10% if `currentWR > initialWR × 1.2`. Active only in the first `(horizonYears − 15)` years, **plus** a crisis override that re-enables it whenever `WR > initialWR × 1.5` regardless of year.
  3. **Prosperity Rule** — raise 10% if `currentWR < initialWR × 0.8`.
  
  **Guardrails are dynamic**: they scale with `initialWR` (±20%). Static 3.2%/4.8% values only hold when IWR = 4%; a Bulletproof 3% start would wrongly trigger Prosperity on Year 1 with static thresholds.

- `runGKSimulation({ startPortfolio, startWithdrawal, nominalReturn, inflation, returnPath, inflationPath, years, initialWR })` — year-by-year projection. Two modes: scalar (pass `nominalReturn`/`inflation`) or path-driven (pass `returnPath`/`inflationPath` arrays). `seedWR = initialWR ?? startWithdrawal / startPortfolio`.

**Monte Carlo:**
- `gaussianSample()` — Box-Muller N(0,1). Reuses the paired sample to halve `Math.random()` calls.
- `sampleReturnPath({ years, equityShare, equityMu, equitySigma, bondMu, bondSigma, rhoEquityBond })` — bivariate correlated return path. Converts geometric means to arithmetic via Jensen's inequality (`μ_arith = μ_geo + σ²/2`). Used by tests; Monte Carlo now uses `sampleCorrelatedPaths`.
- `sampleInflationPath({ years, target, sigma })` — AR(1) inflation with φ=0.85 persistence. Used by tests; Monte Carlo now uses `sampleCorrelatedPaths`.
- `sampleCorrelatedPaths({ years, equityShare, equityMu, equitySigma, bondMu, bondSigma, rhoEquityBond, inflationTarget, inflationSigma, rhoEquityInflation, rhoBondInflation })` — generates both return and inflation paths with a **3×3 Cholesky decomposition** so inflation shocks are correlated with asset shocks. Default correlations: equity-inflation = −0.3, bond-inflation = −0.6. Avoids physically impossible regimes (e.g. 12% inflation + +30% equities) that would inflate MC success rates.
- `runMonteCarlo({...})` — runs N paths via `sampleCorrelatedPaths`, returns `{ bands, successRate, preservationCutRate, cvar10, medianDepletionYear, paths }`. `bands` are cross-sectional P10/P25/P50/P75/P90 per year. CVaR10 is the mean terminal balance of the worst 10% of paths.

**Cashflow helpers:**
- `deriveCashflow(state)` — derives `{ primarySalary, partnerSalary, incomeMonthly, essentials, fun, totalExpenses, surplusMonthly, surplusAnnual, annualExpenses, phase }` from state.
- `effectiveFloor(bucketCfg, monthlyTotal)` — `max(staticFloor, floorMonths × monthlyTotal)`.
- `nextRebalanceBucket(state)` — returns the most underfunded bucket (floor gap takes priority over target gap).
- `monthlyRecommendation(state)` — full surplus/shortfall recommendation with draw-source cascade (Cash → XEON → Bonds → VWCE) and GK-zone-aware fun-budget holdbacks.

**Storage / Sync:**
- `loadState()` / `saveState(state)` — `localStorage` keyed at `"harari-dashboard-state"`. Save is debounced 250ms via `usePersistedState` hook (not synchronous).
- `loadFromGist(token, gistId)` / `saveToGist(token, gistId, state)` — GitHub Gist sync via `api.github.com/gists`. State file: `harari-state.json`.

### `ui.js` — Design system

**Layout:** `Stack`, `Row`

**Display:** `Card` (tones: `default`, `inset`, `raised`, `accent`), `SectionHeader`, `Stat`, `Pill` (tones: `default`, `accent`, `good`, `warn`, `bad`, `ghost`), `Disclosure`, `Sheet`

**Controls:** `Button` (tones: `primary`, `secondary`, `ghost`, `danger`, `success`), `NumberField` (stepper + tap-to-edit), `PrecisionSlider` (range + editable label), `Toggle`, `Segmented`, `TabBar`, `Icon`

**Hooks:** `useViewport()` — returns `{ w, h, isMobile, isTablet, isDesktop }` with mobile breakpoint at 760px. `usePersistedState(initialState)` — loads from localStorage on mount, debounced 250ms save on each change.

### Tabs

**Today** (`today.js`) — read-only situational awareness.
- Hero: portfolio total + FIRE progress ring vs. `annualExpenses / GK_CONFIG.IWR`.
- GK zone ribbon: current WR plotted against static 3.2% / 4.0% / 4.8% display markers (these are informational labels for the canonical 4% IWR framework; simulation uses dynamic guardrails).
- FIRE milestones: 4 IWR tiers (Lean 4.5% vs essentials-only, Aggressive 4%, Recommended 3.5%, Bulletproof 3%) — each shows target portfolio, progress bar, months/ETA. Lean FIRE shows a caution note about zero spending elasticity for GK cuts.
- Monthly recommendation: surplus → bucket to invest in; shortfall → bucket to draw from.
- Runway card: Safety + Cash months.
- Decision triggers: filtered subset of `TRIGGERS` relevant to current state.

`monthsToTarget(target)` uses the closed-form FV formula `n = ln((F·r + c) / (P·r + c)) / ln(1+r)` with **geometric monthly rate** `r = (1 + realReturn)^(1/12) − 1` (not nominal `r/12`). Guards negative denominators to return `Infinity`.

**Plan** (`plan.js`) — strategy inputs.
- Phase selector (switches `currentPhase`; switching to `laid_off` zeros primary salary).
- Bucket balance editors (`NumberField` for VWCE, XEON, Bonds, Cash).
- Allocation drift bars (actual % vs. phase targets, with range bands).
- Monthly income & spending inputs (`monthlySalaryEUR`, `monthlySalaryPartnerEUR`, `monthlyEssentialsEUR`, `monthlyFunEUR`).
- Assumptions: `gkNominalReturn`, `gkInflation`, `bgCgtRatePct`.

**Stress** (`stress.js`) — forward-looking stress testing.
- Linear 40-year GK projection chart (`GKLineChart`) with milestone table.
- Monte Carlo: 6 sliders (equity σ, inflation σ, number of paths, stock-bond ρ, equity-inflation ρ, bond-inflation ρ), button-triggered. Displays success rate, cut-rule rate, median ending balance, CVaR10, median depletion year, and `FanChart` (P10/P25/P50/P75/P90 bands).
- Equity-inflation and bond-inflation correlation sliders default to −0.3 and −0.6 respectively.

**History** (`history.js`) — annual GK log.
- "Record year" form: year label, portfolio at start, actual return, actual inflation.
- Preview: proposed/final withdrawal + GK trigger using `calcGKNextStep`.
- Chronological log of all saved entries with remove option.

### `script.js` — App shell

- `DEFAULT_STATE` — default values for all persisted keys.
- `DEFAULT_GIST_ID` — hardcoded fallback Gist ID (`"2b713c829a9a20c576dfa7612035e2ad"`).
- `SettingsSheet` — slide-up modal for cloud sync (GitHub Gist token + ID, save/load buttons) and local backup (export/import JSON, reset to defaults).
- `Header` — sticky top bar with app logo and settings button.
- `App` — root component; owns `state`/`setState` via `usePersistedState`; routes to `TodayView`, `PlanView`, `StressView`, `HistoryView`.

### State (localStorage key: `"harari-dashboard-state"`)

```js
{
  // Buckets (EUR)
  bucketVWCE: 240000,
  bucketXEON: 28000,
  bucketFixedIncome: 23000,
  bucketCash: 12000,

  // Cashflow (monthly EUR)
  monthlyEssentialsEUR: 2042,
  monthlyFunEUR: 708,
  monthlySalaryEUR: 8750,
  monthlySalaryPartnerEUR: 0,

  // Phase
  currentPhase: "employed",  // "employed" | "laid_off" | "lean_fire" | "full_fire"

  // GK simulation inputs
  gkNominalReturn: 7.0,   // % blended portfolio nominal return
  gkInflation: 2.0,       // % expected CPI
  bgCgtRatePct: 0.0,      // % Bulgarian CGT (0% for UCITS ETFs on regulated EU markets)

  // History
  gkHistory: [],  // [{ id, yearLabel, portfolioStart, actualReturn, actualInflation,
                  //    lastWithdrawal, proposedWithdrawal, finalWithdrawal, trigger, wr, timestamp }]

  // Cloud sync
  cloudGistId: "",
  cloudToken: "",
}
```

Key variable notes:
- `portfolio` — derived as `bucketVWCE + bucketXEON + bucketFixedIncome + bucketCash`; never stored directly.
- `annualExpenses` — derived as `(monthlyEssentialsEUR + monthlyFunEUR) × 12` via `deriveCashflow`.
- `surplusMonthly` — derived as `incomeMonthly − totalExpenses`; negative = drawing from portfolio.
- `currentPhase: "laid_off"` forces `primarySalary = 0` in `deriveCashflow`.
- `bgCgtRatePct` — Bulgarian law (Art. 13 ZDDFL) exempts UCITS ETFs traded on regulated EU/EEA markets (VWCE, XEON on Xetra) from CGT entirely. Default is 0%. The 10% option covers non-exempt instruments.
- `cloudToken` — GitHub classic PAT with `gist` scope (`ghp_...`). Fine-grained tokens do not support the Gist API.
- `gkHistory` — grows as the user records each year-end. Used to determine `lastWithdrawal` baseline throughout the app.

### GitHub Gist Sync

Optional cross-device sync. Setup: classic PAT at `github.com/settings/tokens` with `gist` scope. State round-trips as JSON to `harari-state.json` in the Gist. No credentials leave the browser except to `api.github.com`.

### Service Worker (`sw.js`)

`SW_VERSION` must stay in lock-step with `APP_VERSION` in `engine.js`. Uses **stale-while-revalidate**: serves cached asset instantly, refreshes in background, swaps on next load. Currently the `ASSETS` list only includes `script.js` — all other JS files are fetched from the network on each visit (stale-while-revalidate still caches them after first fetch).

### Tests (`tests.html`)

Open in browser. `engine.js` exposes `window.__FIRE_TESTS__` with `{ calcGKNextStep, runGKSimulation, runMonteCarlo, sampleCorrelatedPaths, sampleReturnPath, sampleInflationPath, gaussianSample, GK_CONFIG, PHASES }`. Tests render pass/fail counts in-page.

## Key Conventions

- All monetary values are **EUR**.
- `gkNominalReturn` is the portfolio-blended expected return. For Monte Carlo, equity-only return is back-calculated: `equityMu = (portfolioReturn − (1−equityShare) × bondMuFixed) / equityShare`.
- Real return is computed via the Fisher equation: `(1 + nominal) / (1 + inflation) − 1`.
- **Withdrawal model: Guyton-Klinger** with IWR 4.0% baseline. Guardrails are dynamic (±20% of `initialWR`), not static absolute values. No inflation cap.
- **GK zone display** in `getGKZone(wr)` and `GKZoneRibbon` uses the static 3.2% / 4.0% / 4.8% values as informational labels for the canonical 4% IWR framework — these are display-only and do not affect the simulation.
- **FIRE targets** are derived from `annualExpenses` (never hardcoded): `annualExpenses / iwr` for each tier.
- **Lean FIRE** uses `essentials × 12 / 0.045` (not full expenses) — it's the minimum threshold, not a recommendation. A GK 10% cut at this tier drops below essential spending; the UI shows a caution note.
- **Tax**: Bulgarian UCITS ETF gains are CGT-exempt (Art. 13 ZDDFL). Draw order (Cash → XEON → Bonds → VWCE) is optimal under this exemption — there's no tax-loss harvesting value at 0% CGT.
- **Draw cascade** in `monthlyRecommendation`: Cash first (no tax, no sequence risk), then XEON (stable value), then Bonds, then VWCE last (growth, never sell in drawdowns).
- No external state management — React `useState` + localStorage only.
- Inline styles throughout (no CSS classes beyond a few in `index.html`).
- Mobile-first responsive: `isMobile` breakpoint at 760px (`useViewport`).
