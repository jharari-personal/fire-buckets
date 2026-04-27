# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-user personal financial planning PWA (Progressive Web App) for managing a FIRE (Financial Independence, Retire Early) strategy. The entire app is in `script.js` — a single file using React 18 (via CDN) with Babel for client-side transpilation. No build step, no npm, no bundler.

## Deployment

Push to `main` → auto-deploys to GitHub Pages. `.nojekyll` disables Jekyll so static files are served as-is.

**After any change, bump `APP_VERSION`** in `script.js` (format: `YYYYMMDD.N`, e.g. `"20260424.1"`). This invalidates the service worker cache so users get the updated files immediately.

## Architecture

All logic lives in `script.js`. The file is structured in three layers:

### 1. Constants & Configuration (top of file)
- `FIRE_TARGETS` — portfolio thresholds: aggressive (550k), recommended (625k), bulletproof (700k)
- `PHASES` — 4 life phases (`employed`, `laid_off`, `coast_fire`, `full_fire`), each with bucket allocation targets and floor amounts
- `BUCKET_META` — metadata for 4 investment buckets: VWCE (growth), XEON (fortress), 29GA (term shield, matures March 2029), EUR cash at IBKR
- `TRIGGERS` — 9 event-driven decision rules with urgency levels
- Geographic scenarios: Plovdiv, Valencia (Beckham Law), Asenovgrad Build, Resort Apartment, Flexible Travel

### 2. Calculation Engine (pure functions)
- `calcBuckets(portfolio, phase)` — allocates portfolio across 4 buckets; floors override percentages when portfolio is small
- `calcSWR(state)` — computes Safe Withdrawal Rate for all 5 geographic scenarios; handles Bulgarian 10% CGT drag
- `calcProjection(state, target)` — months-to-FIRE using compound growth formula; returns `null` if already met, `999` if unreachable in 30 years
- Runway = fortress + termshield + cash amounts

### 3. React Components
- `Dashboard` — top-level state container and tab router; reads/writes localStorage
- `BucketRow` — allocation progress bars with floor override indicators
- `SWRBadge` — color-coded SWR: green ≤3.5%, blue safe, amber elevated, red/dark-red danger
- `Slider` — generic input for the 14 state variables
- `ProjectionRow` — FIRE timeline display
- `useFlash` — 200ms glow animation on value change (skips initial render)
- `useWindowSize` — responsive breakpoint at 768px

### State (localStorage key: `"harari-dashboard-state"`)
14 variables: `portfolio`, `phase`, `monthlyContrib`, `annualExpense`, `wifeIncome`, `schoolCost`, `antiAtrophy`, `travelBudget`, `resortFees`, `buildCost`, `apartmentRent`, `resortCost`, `bgTax10`, `realReturn`

Auto-saves with 500ms debounce on any change. Graceful degradation if localStorage unavailable.

### Service Worker (`sw.js`)
Cache name uses `APP_VERSION`. Cache-first strategy; on activation, deletes old cache versions. Caches: `index.html`, `script.js`, `manifest.json`, icons.

## Key Conventions

- All monetary values are **EUR**
- Real return default: **5%** (≈7-8% nominal minus inflation)
- SWR target: **3.5%** at the €625k recommended threshold
- Tax: Bulgarian CGT is 0% or 10% (toggled), Spanish Beckham Law = 0% CGT for 6 years
- No external state management — React `useState` + localStorage only
- Inline styles throughout (no CSS classes or framework)
- Mobile-first responsive: 2-col desktop grid collapses to 1-col on ≤768px
