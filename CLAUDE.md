# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-user personal financial planning PWA (Progressive Web App) for managing a FIRE (Financial Independence, Retire Early) strategy. The entire app is in `script.js` — a single file using React 18 (via CDN) with Babel for client-side transpilation. No build step, no npm, no bundler.

## Deployment

Push to `main` → auto-deploys to GitHub Pages. `.nojekyll` disables Jekyll so static files are served as-is.

**After any change, bump `APP_VERSION` in BOTH `script.js` AND `SW_VERSION` in `sw.js`** (format: `YYYYMMDD.N`, e.g. `"20260506.0"`). The two strings must stay in sync — they live in separate execution contexts so there's no shared constant. The Service Worker uses its own copy to name the cache; bumping only `script.js` does not invalidate the cache (this was a real bug pre-2026-05-06).

## GitHub CLI

`gh` is not in the PATH of the non-interactive shell that tools run in. Always call it by full path:

```
"C:\Program Files\GitHub CLI\gh.exe"
```

## Architecture

All logic lives in `script.js`. The file is structured in four layers:

### 1. Constants & Configuration (top of file)
- `GK_CONFIG` — Guyton-Klinger parameters: `IWR` 4.0%, `UPPER_GUARDRAIL` 3.2% (Prosperity), `LOWER_GUARDRAIL` 4.8% (Capital Preservation), `ADJUSTMENT` 10%, `INFLATION_CAP` 6%
- `FIRE_TARGETS` was deleted — all FIRE targets are now derived dynamically from `plovTotal` (see Projection tab below).
- `PHASES` — 4 life phases (`employed`, `laid_off`, `lean_fire`, `full_fire`), each with bucket allocation targets and floor amounts. `full_fire` floors reflect GK bucket minimums: fortress €44k (B1, 2yr expenses), termShield €110k (B2, 5yr expenses)
- `BUCKET_META` — metadata for 4 investment buckets: VWCE (growth/B3), XEON (fortress/B1), Fixed Income (B2, instrument-agnostic — currently 29GA bond maturing March 2029), EUR cash at IBKR
- `TRIGGERS` — 10 event-driven decision rules with urgency levels
- Geographic scenarios: Plovdiv, Valencia (Beckham Law), Asenovgrad Build, Resort Apartment, Flexible Travel
- `fmtEur(n)` / `fmtPct(n)` — centralised number formatters

### 2. Calculation Engine (pure functions)
- `calcGKNextStep({ portfolio, lastWithdrawal, annualNominalReturn, inflation, initialWR })` — applies the three GK rules in sequence:
  1. **Inflation Rule** — raise by inflation (capped at 6% — non-canonical house rule), **skip iff BOTH** prior return < 0 AND current pre-raise WR > `initialWR` (canonical Guyton 2006 two-condition gate). `initialWR` defaults to 4% (`GK_CONFIG.IWR`).
  2. **Capital Preservation Rule** — cut 10% if WR > 4.8%
  3. **Prosperity Rule** — raise 10% if WR < 3.2%
  Includes a portfolio-floor guard: returns `{ trigger: "DEPLETED", finalWithdrawal: 0 }` if `portfolio <= 0`.
- `runGKSimulation({ startPortfolio, startWithdrawal, nominalReturn, inflation, returnPath, inflationPath, years, initialWR })` — projects year-by-year using `calcGKNextStep`; stops early if portfolio depleted. Two modes: scalar (legacy: pass `nominalReturn`/`inflation`) or path-driven (pass `returnPath`/`inflationPath` arrays — used by Monte Carlo). Returns array of row objects with per-year `annualReturn`/`annualInflation`.
- `gaussianSample()` — Box-Muller standard-normal sample.
- `sampleReturnPath({ years, equityShare, equityMu, equitySigma, bondMu, bondSigma })` — random equity+bond blended return path.
- `sampleInflationPath({ years, target, sigma })` — mean-reverting AR(1)-ish inflation path.
- `runMonteCarlo({...})` — runs N paths, returns `{ bands: [{year, p10, p50, p90}], successRate, preservationCutRate, paths }`.
- `getSWRTheme(swr)` — color/label for withdrawal rate display, using GK zones (GK SAFE / ELEVATED / CUT ZONE / PROSPERITY ZONE — descriptive labels, not action commands; GK only adjusts annually at review time, never on a transient WR dip).
- `getGKZoneStyle(wr)` — color/label/bg for GK zone indicators.
- Runway = fortress + termShield + cash amounts divided by monthly burn.
- Gist helpers: `loadFromGist(token, gistId)` / `saveToGist(token, gistId, state)` — GET/PATCH/POST `api.github.com/gists/{id}`.
- `monthsTo(target)` — closed-form: `n = ln((target·r + c)/(P·r + c)) / ln(1+r)` (O(1), not iterative). Uses real return; assumes contributions stay flat in real € (i.e. salary tracks inflation). FIRE targets are interpreted as today's-€ amounts.
- Tax-drag formula uses `gainsFraction = max(0, 1 - costBasis/portfolio)` × CGT rate. When `costBasis = 0` (legacy / unset), falls back to a 50% gain assumption.

### 3. React Components
- `Dashboard` — top-level state container and tab router; reads/writes localStorage and optionally syncs to GitHub Gist. Defines two helpers used by both load + connect-Gist paths: `applyHydratedState(s)` (single setter cascade with Math.max(0, ...) defensiveness on bucketCash migration) and `buildPersistState()` (single source of truth for the persisted shape).
- `BucketRow` (memoised) — allocation progress bars; accepts `actualEur` prop and renders actual vs target amounts with ON TARGET / CLOSE / SHORT status badge and a `(floor)` annotation when the floor overrides the % target.
- `SWRBadge` (memoised) — color-coded withdrawal rate badge using GK thresholds.
- `Slider` (memoised) — generic input component.
- `Card` (memoised) — generic dark-card wrapper.
- `ProjectionRow` (memoised) — FIRE timeline display.
- `useFlash` — 200ms glow animation on value change (skips initial render).
- `useWindowSize` — responsive breakpoint at 768px.

### 4. Tabs
- **Runway & Levers** — expense/income sliders, geographic arbitrage scenario cards with GK-labeled SWR badges, situation flags panel; **Income & Cash Flow card** (visible when `employed` or `extraIncome` flag is on) with Monthly Salary slider (employed only), Side Income slider (extraIncome only), and invest/spend allocation output.
- **Allocation** — phase selector; Capital Levers with 4 individual per-bucket sliders (VWCE, XEON, Fixed Income B2, EUR Cash); 4-bucket bar with `BucketRow` breakdown (with `(floor)` annotations); GK 3-Bucket Targets card.
- **Projection** — time-to-FIRE milestones (4 IWR-derived targets: 4.5% Lean, 4.0% GK IWR, 3.5% Recommended, 3.0% Bulletproof); all targets derived dynamically from `plovTotal`; `monthsTo` is closed-form O(1).
- **Withdrawals** — GK rules overview; this-year withdrawal check; 40-year linear-projection simulation table with both **nominal** and **today's-€ (real)** end-balance columns; **Monte Carlo overlay** (button-triggered, Box-Muller paths, P10/P50/P90 bands + success rate + preservation-cut rate); **Die-With-Zero overlay** (constant-real-€ withdrawal solver against `dwzLifeExpectancy` − `dwzCurrentAge` horizon, gap vs current GK base); **Tax-aware withdrawal optimiser** (drains buckets in tax-optimal order Cash → XEON → Fixed → VWCE, shows tax saved vs naive proportional draw); year-by-year withdrawal history log.
- **Settings panel** (gear icon in tab bar) — Cloud Sync (Gist) + Tax & Decumulation Planning inputs (cost basis, Beckham years remaining, post-Beckham Spanish CGT rate, current age, life expectancy, terminal legacy).

### State (localStorage key: `"harari-dashboard-state"`)
Core variables: `bucketVWCE`, `bucketXEON`, `bucketFixed`, `bucketCash`, `phase`, `mainIncome`, `annualExpense`, `wifeIncome`, `schoolCost`, `antiAtrophy`, `travelBudget`, `resortFees`, `buildCost`, `apartmentRent`, `resortCost`, `bgTax10`, `realReturn`, `flags`, `gkBaseWithdrawal`, `gkNominalReturn`, `gkInflation`, `gkHistory`, `costBasis`, `valenciaYearsRemaining`, `spainPostBeckhamRate`, `dwzCurrentAge`, `dwzLifeExpectancy`, `dwzTerminalLegacy`, `ghToken`, `gistId`

Key variable notes:
- `bucketVWCE / bucketXEON / bucketFixed / bucketCash` — the four bucket EUR values; `portfolio` is derived as their sum. Old single `portfolio` localStorage values auto-split by phase allocation targets on first load (migration shim in `applyHydratedState`).
- `mainIncome` — monthly salary (€0–€10,000); replaces old `monthlyContrib`. Migration: if `mainIncome` is absent but `monthlyContrib` exists, loads `monthlyContrib` value.
- `wifeIncome` — "Side Income This Month" value for the per-event income allocation tool (€0–€3,000); **does not affect scenario net draw calculations** — purely used by the Income & Cash Flow card.
- `gkBaseWithdrawal` — current annual GK withdrawal amount; 0 = defaults to `plovTotal`. The simulation projects this **gross** sale forward; net spending depends on each year's gain fraction.
- `gkHistory` — array of year records `{ id, yearLabel, portfolioStart, actualReturn, actualInflation, lastWithdrawal, proposedWithdrawal, trigger, finalWithdrawal, wr, portfolioEnd }`.
- `costBasis` — total € invested net of withdrawn principal. Drives `gainsFraction = max(0, 1 - costBasis/portfolio)` for tax-drag math. `0` = unset → fallback 50% gain assumption.
- `valenciaYearsRemaining` (0–6) — years left of Beckham Law 0% CGT regime. When 0, `spainPostBeckhamRate` (default 21%) kicks in for the Valencia scenario.
- `spainPostBeckhamRate` — decimal (0–0.5), the Spanish CGT rate applied to gains after Beckham expires.
- `dwzCurrentAge` / `dwzLifeExpectancy` / `dwzTerminalLegacy` — Die-With-Zero card inputs. Card displays the constant real-€ withdrawal that depletes portfolio to `dwzTerminalLegacy` at age `dwzLifeExpectancy`.
- `ghToken` / `gistId` — GitHub classic PAT (scope: `gist`) and Gist ID for cross-device sync; stored in localStorage and entered via the settings panel.

`localStorage` writes are synchronous on every state change (no debounce — it's cheap). Only the Gist PATCH is debounced (500ms). Graceful degradation if localStorage unavailable.

### GitHub Gist Sync
Optional cross-device sync via a private GitHub Gist. Setup: generate a **classic** PAT at `github.com/settings/tokens` (not fine-grained — fine-grained tokens do not support the Gist API) with `gist` scope; token starts with `ghp_`. Enter the token and Gist ID in the settings panel (gear icon in the tab bar). State round-trips as JSON to `harari-state.json` in the Gist. No credentials leave the browser except to `api.github.com`.

### Service Worker (`sw.js`)
Cache name uses `SW_VERSION` (declared inside `sw.js` — must be bumped in lock-step with `APP_VERSION` in `script.js`). **Stale-while-revalidate** strategy: serves cached asset instantly, refreshes in background, swaps in the new version on next page load. On activation, deletes old cache versions. Caches: `index.html`, `script.js`, `manifest.json`, icons. Non-GET requests bypass cache. Network failures during navigations fall back to cached `index.html`.

### Tests (`tests.html`)
Open in browser to run assertions over the GK math, Monte Carlo, inflation-skip, depletion guard, and path-driven simulation. `script.js` exposes the pure math via `window.__FIRE_TESTS__` so the harness can import without any build step. Tests render in-page with pass/fail counts.

## Key Conventions

- All monetary values are **EUR**
- Real return default: **5%** (≈7-8% nominal minus inflation). GK simulation uses nominal return + inflation as separate inputs
- Withdrawal model: **Guyton-Klinger** with IWR 4.0% as the baseline rate (replaces static 3.5% SWR)
- GK guardrails: raise 10% if WR < 3.2%; cut 10% if WR > 4.8%; skip annual inflation raise after a negative-return year
- Income is **not** baked into scenario net draw — geographic scenario cards always show gross portfolio draw. Income is handled as a per-event tool in the Income & Cash Flow card:
  - Derived: `effectiveMainIncome = employed ? mainIncome : 0`; `totalMonthlyIncome = effectiveMainIncome + (extraIncome ? wifeIncome : 0)`
  - `netMonthlyCashflow = totalMonthlyIncome − plovGross / 12`
  - `effectiveMonthlyContrib = max(0, netMonthlyCashflow)` — used by projections (contribution falls out of cash flow math, not a manual guess)
  - Surplus invest/spend split by GK zone: 50/65/80/90% to portfolio for RAISE/SAFE/ELEVATED/CUT; +10% toward invest in `employed` phase, +5% in `laid_off`
  - `incomeToSpend` deducts `effectiveAntiAtrophy / 12` from the raw spend surplus to avoid double-counting (fun budget is already in expenses via `plovGross`). If the fun budget fully absorbs the surplus, an orange warning is shown instead of spend permission
  - User manually updates bucket sliders after investing; income does not feed into projections as a long-term assumption
- **FIRE targets are derived from `plovTotal` (actual after-tax annual draw), not hardcoded:**
  - `fireTargetLean        = plovTotal / 0.045` (4.5% IWR)
  - `fireTargetAggressive  = plovTotal / 0.040` (4.0% GK IWR)
  - `fireTargetRecommended = plovTotal / 0.035` (3.5% IWR, GK safe zone entry)
  - `fireTargetBulletproof = plovTotal / 0.030` (3.0% IWR)
  - These drive: all `ProjectionRow` milestone targets, `fireGap`, `fireProgress`, the progress bar, the layoff scenario, and the Withdrawals tab IWR example. Never hardcode a portfolio threshold — use these derived values.
- Bucket recommendation uses actual bucket EUR values vs phase allocation targets; the most-underfunded bucket by % shortfall is recommended, falling back to VWCE when all buckets are on target
- Tax: Bulgarian CGT is 0% or 10% (toggled). Tax drag is `gainsFraction × CGT rate × gross draw`. `gainsFraction = max(0, 1 − costBasis/portfolio)` so tax scales with realised-gain share, not a flat 50%. Spanish **Beckham Law** = 0% CGT for `valenciaYearsRemaining` years (default 6); after the cliff, `spainPostBeckhamRate` (default 21%) applies. The Valencia scenario card uses these.
- No external state management — React `useState` + localStorage only
- Inline styles throughout (no CSS classes or framework)
- Mobile-first responsive: 2-col desktop grid collapses to 1-col on ≤768px
