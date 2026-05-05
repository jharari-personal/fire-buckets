# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-user personal financial planning PWA (Progressive Web App) for managing a FIRE (Financial Independence, Retire Early) strategy. The entire app is in `script.js` — a single file using React 18 (via CDN) with Babel for client-side transpilation. No build step, no npm, no bundler.

## Deployment

Push to `main` → auto-deploys to GitHub Pages. `.nojekyll` disables Jekyll so static files are served as-is.

**After any change, bump `APP_VERSION`** in `script.js` (format: `YYYYMMDD.N`, e.g. `"20260505.7"`). This invalidates the service worker cache so users get the updated files immediately.

## GitHub CLI

`gh` is not in the PATH of the non-interactive shell that tools run in. Always call it by full path:

```
"C:\Program Files\GitHub CLI\gh.exe"
```

## Architecture

All logic lives in `script.js`. The file is structured in four layers:

### 1. Constants & Configuration (top of file)
- `GK_CONFIG` — Guyton-Klinger parameters: `IWR` 4.0%, `UPPER_GUARDRAIL` 3.2% (Prosperity), `LOWER_GUARDRAIL` 4.8% (Capital Preservation), `ADJUSTMENT` 10%, `INFLATION_CAP` 6%
- `FIRE_TARGETS` — legacy constant (550k/625k/700k); **no longer used in calculations or display** — all FIRE targets are now derived dynamically from `plovTotal` (see Projection tab below). `FIRE_TARGETS` remains only in the static `TRIGGERS` array descriptions.
- `PHASES` — 4 life phases (`employed`, `laid_off`, `lean_fire`, `full_fire`), each with bucket allocation targets and floor amounts. `full_fire` floors reflect GK bucket minimums: fortress €44k (B1, 2yr expenses), termShield €110k (B2, 5yr expenses)
- `BUCKET_META` — metadata for 4 investment buckets: VWCE (growth/B3), XEON (fortress/B1), Fixed Income (B2, instrument-agnostic — currently 29GA bond maturing March 2029), EUR cash at IBKR
- `TRIGGERS` — 10 event-driven decision rules with urgency levels
- Geographic scenarios: Plovdiv, Valencia (Beckham Law), Asenovgrad Build, Resort Apartment, Flexible Travel

### 2. Calculation Engine (pure functions)
- `calcGKNextStep({ portfolio, lastWithdrawal, annualNominalReturn, inflation })` — applies the three GK rules in sequence: (1) Inflation Rule — raise by inflation (capped at 6%), skip entirely if last year's return was negative; (2) Capital Preservation Rule — cut 10% if WR > 4.8%; (3) Prosperity Rule — raise 10% if WR < 3.2%. Returns `{ proposedWithdrawal, finalWithdrawal, trigger, wr }`
- `runGKSimulation({ startPortfolio, startWithdrawal, nominalReturn, inflation, years })` — projects year-by-year using `calcGKNextStep`; stops early if portfolio depleted. Returns array of row objects
- `getSWRTheme(swr)` — color/label for withdrawal rate display, using GK thresholds (GK SAFE / ELEVATED / CUT −10% / RAISE +10%)
- `getGKZoneStyle(wr)` — color/label/bg for GK zone indicators
- Runway = fortress + termShield + cash amounts divided by monthly burn
- Gist helpers: `loadFromGist(token, gistId)` / `saveToGist(token, gistId, state)` — GET/PATCH/POST `api.github.com/gists/{id}`

### 3. React Components
- `Dashboard` — top-level state container and tab router; reads/writes localStorage and optionally syncs to GitHub Gist
- `BucketRow` — allocation progress bars; accepts `actualEur` prop and renders actual vs target amounts with ON TARGET / CLOSE / SHORT status badge
- `SWRBadge` — color-coded withdrawal rate badge using GK thresholds
- `Slider` — generic input component
- `ProjectionRow` — FIRE timeline display
- `useFlash` — 200ms glow animation on value change (skips initial render)
- `useWindowSize` — responsive breakpoint at 768px

### 4. Tabs
- **Runway & Levers** — expense/income sliders, geographic arbitrage scenario cards with GK-labeled SWR badges, situation flags panel; **Income & Cash Flow card** (visible when `employed` or `extraIncome` flag is on) with Monthly Salary slider (employed only), Side Income slider (extraIncome only), and invest/spend allocation output
- **Allocation** — phase selector (moved here from Runway); Capital Levers with 4 individual per-bucket sliders (VWCE, XEON, Fixed Income B2, EUR Cash) — total is derived and displayed; 4-bucket bar with `BucketRow` breakdown; GK 3-Bucket Targets card (B1/B2/B3 with ON TARGET / SHORT / OVER status) shown for `full_fire` and `lean_fire` phases
- **Projection** — time-to-FIRE milestones (4 IWR-derived targets: 4.5% Lean, 4.0% Aggressive, 3.5% Recommended, 3.0% Bulletproof) + layoff scenario; all targets derived dynamically from `plovTotal` — changing expenses immediately updates every milestone and the progress bar. GK Post-FIRE Sustainability card simulates from the **current portfolio** (not a hardcoded target) using `gkNominalReturn` and `gkInflation` from the Withdrawals tab, showing portfolio at years 10/20/30/40/50. Monthly contribution is shown as a read-only calculated value (derived from income − expenses).
- **Withdrawals** — GK rules overview; this-year withdrawal check (last year's return + this year's inflation → recommended withdrawal with trigger); base withdrawal slider; 40-year simulation table; year-by-year withdrawal history log with "Record Year" form

### State (localStorage key: `"harari-dashboard-state"`)
Core variables: `bucketVWCE`, `bucketXEON`, `bucketFixed`, `bucketCash`, `phase`, `mainIncome`, `annualExpense`, `wifeIncome`, `schoolCost`, `antiAtrophy`, `travelBudget`, `resortFees`, `buildCost`, `apartmentRent`, `resortCost`, `bgTax10`, `realReturn`, `flags`, `gkBaseWithdrawal`, `gkNominalReturn`, `gkInflation`, `gkHistory`, `ghToken`, `gistId`

Key variable notes:
- `bucketVWCE / bucketXEON / bucketFixed / bucketCash` — the four bucket EUR values; `portfolio` is derived as their sum. Old single `portfolio` localStorage values auto-split by phase allocation targets on first load (migration shim in load effect)
- `mainIncome` — monthly salary (€0–€10,000); replaces old `monthlyContrib`. Migration: if `mainIncome` is absent but `monthlyContrib` exists, loads `monthlyContrib` value
- `wifeIncome` — "Side Income This Month" value for the per-event income allocation tool (€0–€3,000); **does not affect scenario net draw calculations** — purely used by the Income & Cash Flow card
- `gkBaseWithdrawal` — current annual GK withdrawal amount; 0 = defaults to `plovTotal` (current expense level)
- `gkHistory` — array of year records `{ id, yearLabel, portfolioStart, actualReturn, actualInflation, lastWithdrawal, proposedWithdrawal, trigger, finalWithdrawal, wr, portfolioEnd }`
- `ghToken` / `gistId` — GitHub classic PAT (scope: `gist`) and Gist ID for cross-device sync; stored in localStorage and entered via the settings panel in the tab bar

Auto-saves with 500ms debounce on any change. Graceful degradation if localStorage unavailable.

### GitHub Gist Sync
Optional cross-device sync via a private GitHub Gist. Setup: generate a **classic** PAT at `github.com/settings/tokens` (not fine-grained — fine-grained tokens do not support the Gist API) with `gist` scope; token starts with `ghp_`. Enter the token and Gist ID in the settings panel (gear icon in the tab bar). State round-trips as JSON to `harari-state.json` in the Gist. No credentials leave the browser except to `api.github.com`.

### Service Worker (`sw.js`)
Cache name uses `APP_VERSION`. Cache-first strategy; on activation, deletes old cache versions. Caches: `index.html`, `script.js`, `manifest.json`, icons.

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
- Tax: Bulgarian CGT is 0% or 10% (toggled), Spanish Beckham Law = 0% CGT for 6 years
- No external state management — React `useState` + localStorage only
- Inline styles throughout (no CSS classes or framework)
- Mobile-first responsive: 2-col desktop grid collapses to 1-col on ≤768px
