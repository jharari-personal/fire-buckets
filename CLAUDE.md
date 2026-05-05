# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-user personal financial planning PWA (Progressive Web App) for managing a FIRE (Financial Independence, Retire Early) strategy. The entire app is in `script.js` — a single file using React 18 (via CDN) with Babel for client-side transpilation. No build step, no npm, no bundler.

## Deployment

Push to `main` → auto-deploys to GitHub Pages. `.nojekyll` disables Jekyll so static files are served as-is.

**After any change, bump `APP_VERSION`** in `script.js` (format: `YYYYMMDD.N`, e.g. `"20260504.1"`). This invalidates the service worker cache so users get the updated files immediately.

## GitHub CLI

`gh` is not in the PATH of the non-interactive shell that tools run in. Always call it by full path:

```
"C:\Program Files\GitHub CLI\gh.exe"
```

## Architecture

All logic lives in `script.js`. The file is structured in four layers:

### 1. Constants & Configuration (top of file)
- `GK_CONFIG` — Guyton-Klinger parameters: `IWR` 4.0%, `UPPER_GUARDRAIL` 3.2% (Prosperity), `LOWER_GUARDRAIL` 4.8% (Capital Preservation), `ADJUSTMENT` 10%, `INFLATION_CAP` 6%
- `FIRE_TARGETS` — portfolio thresholds: aggressive (550k), recommended (625k), bulletproof (700k)
- `PHASES` — 4 life phases (`employed`, `laid_off`, `lean_fire`, `full_fire`), each with bucket allocation targets and floor amounts. `full_fire` floors reflect GK bucket minimums: fortress €44k (B1, 2yr expenses), termShield €110k (B2, 5yr expenses)
- `BUCKET_META` — metadata for 4 investment buckets: VWCE (growth/B3), XEON (fortress/B1), 29GA (term shield/B2, matures March 2029), EUR cash at IBKR
- `TRIGGERS` — 10 event-driven decision rules with urgency levels
- Geographic scenarios: Plovdiv, Valencia (Beckham Law), Asenovgrad Build, Resort Apartment, Flexible Travel

### 2. Calculation Engine (pure functions)
- `calcGKNextStep({ portfolio, lastWithdrawal, annualNominalReturn, inflation })` — applies the three GK rules in sequence: (1) Inflation Rule — raise by inflation (capped at 6%), skip entirely if last year's return was negative; (2) Capital Preservation Rule — cut 10% if WR > 4.8%; (3) Prosperity Rule — raise 10% if WR < 3.2%. Returns `{ proposedWithdrawal, finalWithdrawal, trigger, wr }`
- `runGKSimulation({ startPortfolio, startWithdrawal, nominalReturn, inflation, years })` — projects year-by-year using `calcGKNextStep`; stops early if portfolio depleted. Returns array of row objects
- `getSWRTheme(swr)` — color/label for withdrawal rate display, using GK thresholds (GK SAFE / ELEVATED / CUT −10% / RAISE +10%)
- `getGKZoneStyle(wr)` — color/label/bg for GK zone indicators
- Runway = fortress + termShield + cash amounts divided by monthly burn

### 3. React Components
- `Dashboard` — top-level state container and tab router; reads/writes localStorage
- `BucketRow` — allocation progress bars with floor override indicators
- `SWRBadge` — color-coded withdrawal rate badge using GK thresholds
- `Slider` — generic input component
- `ProjectionRow` — FIRE timeline display
- `useFlash` — 200ms glow animation on value change (skips initial render)
- `useWindowSize` — responsive breakpoint at 768px

### 4. Tabs
- **Runway & Levers** — portfolio slider, expense/income sliders, geographic arbitrage scenario cards with GK-labeled SWR badges, situation flags panel; "Side Income This Month" card (visible when `extraIncome` flag is on) for per-event income allocation
- **Allocation** — 4-bucket bar with `BucketRow` breakdown; GK 3-Bucket Targets card (B1/B2/B3 with ON TARGET / SHORT / OVER status) shown for `full_fire` and `lean_fire` phases
- **Projection** — time-to-FIRE milestones + layoff scenario; GK Post-FIRE Sustainability card showing portfolio at years 10/20/30/40/50 from the €625k FIRE target
- **Withdrawals** — GK rules overview; this-year withdrawal check (last year's return + this year's inflation → recommended withdrawal with trigger); base withdrawal slider; 40-year simulation table; year-by-year withdrawal history log with "Record Year" form

### State (localStorage key: `"harari-dashboard-state"`)
18 variables: `portfolio`, `phase`, `monthlyContrib`, `annualExpense`, `wifeIncome`, `schoolCost`, `antiAtrophy`, `travelBudget`, `resortFees`, `buildCost`, `apartmentRent`, `resortCost`, `bgTax10`, `realReturn`, `flags`, `gkBaseWithdrawal`, `gkNominalReturn`, `gkInflation`, `gkHistory`

- `wifeIncome` — "Income This Month" value for the per-event income allocation tool (€0–€3,000); **does not affect scenario net draw calculations** — purely used by the Side Income This Month card
- `gkBaseWithdrawal` — current annual GK withdrawal amount; 0 = defaults to `plovTotal` (current expense level)
- `gkHistory` — array of year records `{ id, yearLabel, portfolioStart, actualReturn, actualInflation, lastWithdrawal, proposedWithdrawal, trigger, finalWithdrawal, wr, portfolioEnd }`

Auto-saves with 500ms debounce on any change. Graceful degradation if localStorage unavailable.

### Service Worker (`sw.js`)
Cache name uses `APP_VERSION`. Cache-first strategy; on activation, deletes old cache versions. Caches: `index.html`, `script.js`, `manifest.json`, icons.

## Key Conventions

- All monetary values are **EUR**
- Real return default: **5%** (≈7-8% nominal minus inflation). GK simulation uses nominal return + inflation as separate inputs
- Withdrawal model: **Guyton-Klinger** with IWR 4.0% at the €625k recommended threshold (replaces static 3.5% SWR)
- GK guardrails: raise 10% if WR < 3.2%; cut 10% if WR > 4.8%; skip annual inflation raise after a negative-return year
- Side income is **not** baked into scenario net draw — geographic scenario cards always show gross portfolio draw with no income assumption. Income is handled as a per-event tool: the "Side Income This Month" card takes a monthly amount and recommends an invest/spend split based on the current GK withdrawal rate zone (50/50 at RAISE, 65/35 at SAFE, 80/20 at ELEVATED, 90/10 at CUT), with +10% toward invest in `employed` phase. User manually updates the portfolio slider after investing.
- Tax: Bulgarian CGT is 0% or 10% (toggled), Spanish Beckham Law = 0% CGT for 6 years
- No external state management — React `useState` + localStorage only
- Inline styles throughout (no CSS classes or framework)
- Mobile-first responsive: 2-col desktop grid collapses to 1-col on ≤768px
