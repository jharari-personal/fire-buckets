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
| `freedom.js` | **Freedom** tab — financial independence scenario modeler |
| `stress.js` | **Stress** tab — linear projection + Monte Carlo |
| `history.js` | **History** tab — annual GK log |
| `script.js` | App shell — `SettingsSheet`, `Header`, `App` root, `ReactDOM.createRoot` |
| `sw.js` | Service Worker (stale-while-revalidate) |

Load order in `index.html`: `engine.js` → `ui.js` → `today.js` → `plan.js` → `freedom.js` → `stress.js` → `history.js` → `script.js`.

## Keeping CLAUDE.md current

**After every task, update this file** to reflect any changes made — new components, renamed variables, changed section layouts, new conventions, removed items. Do not leave CLAUDE.md stale. If a section no longer matches the code, fix it before ending the turn.

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
- `PHASES` — 6 life phases (`employed`, `coast_fire`, `barista_fire`, `laid_off`, `lean_fire`, `full_fire`), each with bucket allocation `target`, `range`, `floor`, and `floorMonths`. The effective floor is `max(staticFloor, floorMonths × monthlyTotal)`. Phase order in Plan tab: Employed → Coast FIRE → Barista FIRE → Sabbatical → Lean Independence → Full FIRE.
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
- `effectiveLastWithdrawal(state)` — returns the most recent `gkHistory.finalWithdrawal` if available; otherwise `0` when accumulating (surplus ≥ 0) and `annualExpenses` only when actively drawing. Replaces the older "always default to `annualExpenses`" fallback, which produced a phantom Cut-zone WR while employed.
- `nextRebalanceBucket(state)` — returns `{ underweight, overweight }`. `underweight` is the most pressing bucket to add money to (floor deficit > %-allocation deficit), with `floor`, `floorMonths`, `targetPct`, and `range` fields so the UI can explain the choice. `overweight` is the most-overweight bucket beyond its range upper (with a 0.5%-of-portfolio noise tolerance), or `null`.
- `monthlyOutlook(state)` — structured monthly plan with three modes: `"accumulating"` (surplus ≥ 0 and either no GK history or still in an earning phase — `employed` / `coast_fire` / `barista_fire`), `"lean_drawdown"` (small shortfall fully covered by trimming fun), `"shortfall"` (draw required, with cascade source Cash → XEON → Bonds → VWCE). Returns `{ mode, primary: { verb, amount, bucketKey, meta, reason }, secondary: [...], floorContext, headline, subtitle, ... }`. In `accumulating` mode, `funCut` is always 0 (the prior zone-based fun-budget holdback was wrong for employed users not drawing from the portfolio). Secondary actions include `rebalance_out` (flag overweight buckets), `fun_trim`, `xeon_low`, `cgt`.
- `monthlyRecommendation(state)` — thin alias for `monthlyOutlook` kept for back-compat; remaps `mode: "accumulating"` to `"surplus"`.

**Storage / Sync:**
- `loadState()` / `saveState(state)` — `localStorage` keyed at `"harari-dashboard-state"`. Save is debounced 250ms via `usePersistedState` hook (not synchronous).
- `loadFromGist(token, gistId)` / `saveToGist(token, gistId, state)` — GitHub Gist sync via `api.github.com/gists`. State file: `harari-state.json`.

### `ui.js` — Design system

**Layout:** `Stack`, `Row`

**Display:** `Card` (tones: `default`, `inset`, `raised`, `accent`), `SectionHeader`, `Stat`, `Pill` (tones: `default`, `accent`, `good`, `warn`, `bad`, `ghost`), `Disclosure`, `Sheet`

**Controls:** `Button` (tones: `primary`, `secondary`, `ghost`, `danger`, `success`), `NumberField` (stepper + tap-to-edit), `PrecisionSlider` (range + editable label), `Toggle`, `Segmented`, `TabBar`, `Icon`

**Hooks:** `useViewport()` — returns `{ w, h, isMobile, isTablet, isDesktop }` with mobile breakpoint at 760px. `usePersistedState(initialState)` — loads from localStorage on mount, debounced 250ms save on each change.

### Tabs

**Today** (`today.js`) — read-only situational awareness. Section order (top to bottom):
1. **Hero** — `ProgressRing` rebased to **Bulletproof FIRE as 100%** (not Aggressive), so the ring is a true journey map. Four milestone ticks drawn on the ring arc at their proportional positions. Portfolio total, gap-to-FIRE sentence (3-way branch: crossed / finite pace / no-surplus). `MilestoneJourney` SVG bar below the sentence: horizontal track with milestone dots + user pin + "Next milestone: X in Y" headline. No coverage cards in the hero.
2. **GK zone ribbon** (`GKZoneRibbon`) — **only rendered when `outlook.mode !== "accumulating"`**, placed **directly under the hero** with `tone="accent"` for visual weight. WR marker is white-fill + colored ring. Rationale shows concrete €amounts. `currentAnnual` and `proposedAnnual` props.
3. **Portfolio capacity today** (`PortfolioCapacityCard`) — safe monthly income shown big once (€/mo + €/yr at 4% IWR), then `CoverageBar` for Essentials and Full lifestyle (% + gap + inline progress bar). Tone-coded: good/warn/bad.
4. **This Month** (`ThisMonthCard`) — action card. Mode pill top-right. Cashflow chip strip. Primary action block with bucket-color border, Why/After rationale. Floor tracker when floor-driven. Secondary rows: `rebalance_out`, `fun_trim`, `xeon_low`, `cgt`.
5. **FIRE milestones** — compact `MilestoneRow` per tier (dot + name + WR badge + 80px mini-bar + months right-aligned). Lean FIRE caution shrunk to `⚠` tooltip (`title` attribute). "If contributions stopped tomorrow" footnote in a `Disclosure` (collapsed by default).
6. **Runway + Allocation** two-up:
   - **Runway**: `safeRunwayMonths` = (XEON + Cash + Bonds) / monthlyExpenses (all 3 defense buckets, not just Safety+Cash). `RunwayStackedBar` shows Cash / Safety / Stability segments proportional to months, with hatched Growth tail. Axis labels below. Chips removed.
   - **Allocation**: donut + drift rows with `|drift| ≥ 1.5 pp` Pill badges. Rebalance hint appended when any bucket drifts ≥ 3 pp.
7. **Decisions ahead** — sorted by urgency (`immediate > week > month > quarter`). Top 2 shown inline via `TriggerRow`. Remaining hidden in `Disclosure` ("Show N more"). `TriggerRow` is a module-level helper component.

`fmtMonths(n)` and `fmtETA(n)` are **module-level** helpers (not inside `TodayView`) — shared by `MilestoneJourney`, `MilestoneRow`, and `TodayView`.

`ThisMonthCard` lives in `today.js` next to `TodayView`. WR is computed via `effectiveLastWithdrawal(state)` so accumulating users see WR = 0 (not a phantom forecast).

`ringProgress = portfolio / bulletproofTarget` drives the ring arc and label. `progress = portfolio / fireTarget` (Aggressive) drives the hero sentence logic only.

`monthsToTarget(portfolio, target, monthlySurplus, realReturnMonthly)` — standalone pure function in `engine.js` (exported to `window`). Uses the closed-form FV formula `n = ln((F·r + c) / (P·r + c)) / ln(1+r)` with **geometric monthly rate** `r = (1 + realReturn)^(1/12) − 1` (not nominal `r/12`). Guards negative denominators to return `Infinity`. Used by both Today and Freedom tabs.

**Plan** (`plan.js`) — strategy inputs. This is the **single source of truth** for all financial variables. Today and Freedom are visualization-only dashboards; Plan is where numbers are entered.
- **Phase selector** — `PhaseBadge` buttons with active state: accent border + glow + dot indicator + accent-colored text on the active phase. (3×2 grid on mobile, 3-column on desktop for 6 phases; switches `currentPhase`; switching to `laid_off` zeros primary salary.)
- Bucket balance editors (`NumberField` for VWCE, XEON, Bonds, Cash).
- **Allocation drift bars** — legend row above bars (Actual / Target / Acceptable range swatches). Drift Pill badges shown when `|drift| >= 1.5 pp`. Only `eyebrow="Allocation"` and `eyebrow="Phase"` are present — all other eyebrows removed.
- Monthly income & spending inputs (`monthlySalaryEUR`, `monthlySalaryPartnerEUR`, `monthlyEssentialsEUR`, `monthlyFunEUR`).
- **Post-exit income sources** — only enabled sources are shown by default. Disabled sources are hidden behind a dashed "+ Add a future income source ▾" button that expands a checklist. Each source has `enabled` Toggle, `amt` NumberField (€/mo), and `dur` PrecisionSlider (1–600 months; 600 = Indefinite). State keys: `freelanceEnabled/Amt/Dur`, `parttimeEnabled/Amt/Dur`, `passiveEnabled/Amt/Dur`. Partner income amount (`monthlySalaryPartnerEUR`) is set in the income section above.
- **Spending footer** — large "Total spending" amount, then below it two bordered rows: (1) "Annualised: €X" and (2) "FIRE target (4% IWR): €X". 
- Assumptions: `gkNominalReturn`, `gkInflation`, `bgCgtRatePct`.

**Freedom** (`freedom.js`) — financial independence scenario modeler. **Mostly read-only** — it visualizes variables from Plan state. The only editable inputs are scenario-specific: the `extraMonths` slider, exit scenario inputs (Section 2), and the partner income toggle/duration in Section 3. All Freedom state is persisted to global state (no local `useState`). The 5 sections are interconnected: exit portfolio flows from Section 2 into Sections 3–5, and monthly gap from Section 3 flows into Section 4. **No eyebrow labels** in Freedom — all section headers are plain. **Sections 2 and 3 are side-by-side in a 2-column grid on desktop** (`isDesktop` via `useViewport`; single column on mobile/tablet). Freedom tab `maxWidth` is `1240` (vs `1080` for other tabs).

- **Section 1: Employment Countdown** — Days since `EMPLOYMENT_START` (Jan 1 2026), EUR earned and invested since start. "N more months" `PrecisionSlider` (0–24) projects additional portfolio using **primary salary surplus only** (excludes partner/side income) with **simple addition** (no compounding): `projectedPortfolio = portfolio + N × max(0, primarySalary − totalExpenses)`. Persisted as `extraMonths`.

- **Section 2: Exit Scenario Simulator** — Inputs: exit timing (0–24 months out), severance (0–12 months of salary), bonus toggle + amount, unpaid vacation days. All persisted as `exitMonthsOut`, `severanceMonths`, `bonusEnabled`, `bonusAmount`, `vacationDays`. Computes `exitPortfolio = currentPortfolio + (monthsUntilExit × surplusMonthly) + lumpSum`. **Layout**: headline portfolio value, then immediately a **coverage strip** (`1.4fr 1fr 1fr` grid): (a) safe monthly income at 4% IWR, (b) essentials coverage % with EUR gap, (c) full lifestyle coverage % with EUR gap. Then detail row + lump-sum range labelled **"Best case if you negotiate:"** (not "Best/Worst case").

- **Section 3: Hybrid Income Model** — Income sources are **read-only displays** that reflect the values configured in Plan. Only **enabled** sources are rendered via `ReadOnlyIncomeRow`; if none are enabled, a hint text is shown. Freelance, part-time, and passive sources show an "Edit in Plan" badge. Partner income shows amount locked from `monthlySalaryPartnerEUR`, but the toggle (`partnerIncludedInScenario`) and duration (`partnerDurScenario`) are editable. Expenses panel shows read-only values with "Edit in Plan" badge. Monthly gap displayed in **neutral `var(--fg)` color** (not red). **Killer insight callout**: shown when `monthlyGap > 0 && adjustedFireTarget < fullFireTarget` — a green-gradient card showing "Your FIRE target drops by €X · From €Y to €Z · ~N years off your timeline." `incomeAtMonth(m)` computes income at any month post-exit. `avgMonthlyIncome` time-weights over **120-month horizon**. Local `fmtMonths(m)` helper. Derives: avg monthly income, monthly gap, effective WR (color-coded by GK zone), adjusted FIRE target.

- **Section 4: Bucket Drawdown Sequencer** — Two-pane layout: **defense-only chart** (left, `defenseOnly` prop shows Cash/XEON/Bonds stacked area only) + **VWCE stat panel** (right). Runway displayed as a **stepper** with 4 steps: "Cash only", "+ Safety", "+ Stability", "Then Growth" each with a duration badge. `DrawdownChart` accepts `defenseOnly: bool` — when true, renders only `["cash","xeon","bonds"]` layers and scales `maxV` to their combined peak. Duration-aware month-by-month simulation; draw cascade: Cash → XEON → Bonds → VWCE. VWCE compounds at `gkNominalReturn` while not being drawn.

- **Section 5: Sensitivity Matrix** — `SensitivityGrid` is a 7×9 HTML table (annual spend 18k–30k vs annual income 0–24k). Each cell shows withdrawal rate `max(0, spend − income) / exitPortfolio × 100`, color-coded by GK zones. Current scenario cell highlighted with accent border. **"You are here" annotation row** above the table shows current spend/income/WR. **Gradient strip legend** (green → yellow → red) with zone labels replacing the old chip row. Table uses `width: 100%` with `tableLayout: fixed`.

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
- `App` — root component; owns `state`/`setState` via `usePersistedState`; routes to `TodayView`, `PlanView`, `FreedomView`, `StressView`, `HistoryView`. Tab order: Today · Plan · Freedom · Stress · History. `maxWidth` is `1240` for Freedom tab, `1080` for all others.

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
  currentPhase: "employed",  // "employed" | "coast_fire" | "barista_fire" | "laid_off" | "lean_fire" | "full_fire"

  // GK simulation inputs
  gkNominalReturn: 7.0,   // % blended portfolio nominal return
  gkInflation: 2.0,       // % expected CPI
  bgCgtRatePct: 0.0,      // % Bulgarian CGT (0% for UCITS ETFs on regulated EU markets)

  // History
  gkHistory: [],  // [{ id, yearLabel, portfolioStart, actualReturn, actualInflation,
                  //    lastWithdrawal, proposedWithdrawal, finalWithdrawal, trigger, wr, timestamp }]

  // Personal context (used by trigger evaluation)
  userBirthYear: 1993,
  daughterBirthYear: 2022,
  ecbDepositRate: 2.0,
  healthInsuranceMonthlyEUR: 19,
  sorrSeverityPct: 15,

  // Cloud sync
  cloudGistId: "",
  cloudToken: "",

  // Settings
  showAdvanced: false,

  // Freedom tab — employment tracker
  extraMonths: 0,

  // Freedom tab — exit scenario (UI lives in Freedom, persisted to global state)
  exitMonthsOut: 3,
  severanceMonths: 0,
  bonusEnabled: false,
  bonusAmount: 0,
  vacationDays: 0,

  // Post-exit income sources (configured in Plan tab, read by Freedom tab)
  freelanceEnabled: false,
  freelanceAmt: 0,
  freelanceDur: 600,
  parttimeEnabled: false,
  parttimeAmt: 0,
  parttimeDur: 600,
  passiveEnabled: false,
  passiveAmt: 0,
  passiveDur: 600,

  // Freedom scenario — partner income controls (amount comes from monthlySalaryPartnerEUR)
  partnerIncludedInScenario: true,
  partnerDurScenario: 600,
}
```

Key variable notes:
- `portfolio` — derived as `bucketVWCE + bucketXEON + bucketFixedIncome + bucketCash`; never stored directly.
- `annualExpenses` — derived as `(monthlyEssentialsEUR + monthlyFunEUR) × 12` via `deriveCashflow`.
- `surplusMonthly` — derived as `incomeMonthly − totalExpenses`; negative = drawing from portfolio.
- `currentPhase: "laid_off"` forces `primarySalary = 0` in `deriveCashflow`.
- `currentPhase: "coast_fire"` — earning covers expenses, portfolio compounds untouched. 86% growth target.
- `currentPhase: "barista_fire"` — part-time income supplements small portfolio draws. 80% growth target.
- `currentPhase: "lean_fire"` — labelled "Lean Independence" in UI. Essentials-only from portfolio, no income required.
- `bgCgtRatePct` — Bulgarian law (Art. 13 ZDDFL) exempts UCITS ETFs traded on regulated EU/EEA markets (VWCE, XEON on Xetra) from CGT entirely. Default is 0%. The 10% option covers non-exempt instruments.
- `cloudToken` — GitHub classic PAT with `gist` scope (`ghp_...`). Fine-grained tokens do not support the Gist API.
- `gkHistory` — grows as the user records each year-end. Used to determine `lastWithdrawal` baseline throughout the app.
- `userBirthYear`, `daughterBirthYear`, `ecbDepositRate`, `healthInsuranceMonthlyEUR`, `sorrSeverityPct` — personal context fields used by trigger evaluation. Editable in Settings.

### GitHub Gist Sync

Optional cross-device sync. Setup: classic PAT at `github.com/settings/tokens` with `gist` scope. State round-trips as JSON to `harari-state.json` in the Gist. No credentials leave the browser except to `api.github.com`.

### Service Worker (`sw.js`)

`SW_VERSION` must stay in lock-step with `APP_VERSION` in `engine.js`. Uses **stale-while-revalidate**: serves cached asset instantly, refreshes in background, swaps on next load. The `ASSETS` list includes `script.js` and `freedom.js` — other JS files are fetched from the network on each visit (stale-while-revalidate still caches them after first fetch).

### Tests (`tests.html`)

Open in browser. `engine.js` exposes `window.__FIRE_TESTS__` with `{ calcGKNextStep, runGKSimulation, runMonteCarlo, sampleCorrelatedPaths, sampleReturnPath, sampleInflationPath, gaussianSample, GK_CONFIG, PHASES }`. Tests render pass/fail counts in-page.

## Key Conventions

- All monetary values are **EUR**.
- `gkNominalReturn` is the portfolio-blended expected return. For Monte Carlo, equity-only return is back-calculated: `equityMu = (portfolioReturn − (1−equityShare) × bondMuFixed) / equityShare`.
- Real return is computed via the Fisher equation: `(1 + nominal) / (1 + inflation) − 1`.
- **Withdrawal model: Guyton-Klinger** with IWR 4.0% baseline. Guardrails are dynamic (±20% of `initialWR`), not static absolute values. No inflation cap.
- **GK zone display** in `getGKZone(wr)` and `GKZoneRibbon` uses the static 3.2% / 4.0% / 4.8% values as informational labels for the canonical 4% IWR framework — these are display-only and do not affect the simulation.
- **FIRE targets** are derived from `annualExpenses` (never hardcoded): `annualExpenses / iwr` for each tier.
- **Lean FIRE** (labelled "Lean Independence" in UI, phase ID remains `lean_fire`) uses `essentials × 12 / 0.045` (not full expenses) — it's the minimum threshold, not a recommendation. A GK 10% cut at this tier drops below essential spending; the UI shows a caution note.
- **Tax**: Bulgarian UCITS ETF gains are CGT-exempt (Art. 13 ZDDFL). Draw order (Cash → XEON → Bonds → VWCE) is optimal under this exemption — there's no tax-loss harvesting value at 0% CGT.
- **Draw cascade** in `monthlyOutlook` (shortfall mode): Cash first (no tax, no sequence risk), then XEON (stable value), then Bonds, then VWCE last (growth, never sell in drawdowns).
- **Accumulating vs. drawing**: while `currentPhase ∈ {employed, coast_fire, barista_fire}` with positive surplus, `monthlyOutlook` returns `mode: "accumulating"` and the Today tab hides the GK zone ribbon and skips any fun-budget holdback. WR is only meaningful while actually drawing.
- No external state management — React `useState` + localStorage only.
- Inline styles throughout (no CSS classes beyond a few in `index.html`).
- Mobile-first responsive: `isMobile` breakpoint at 760px (`useViewport`).
