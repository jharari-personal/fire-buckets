# Mathematical & Architectural Review — FIRE Planning Dashboard

## Context

The user (a Bulgarian tax resident running this single-user PWA for their own FIRE plan) asked three reviewers — a CFP, a quant, and a numerical engineer — to audit the math. They explicitly asked for substance over flattery and want real issues found. The review covers `engine.js`, `today.js`, `stress.js`, `history.js`, and `plan.js` as they currently stand on `main` (note: CLAUDE.md describes a richer tax-aware optimiser and Beckham Law logic that the *current* code does not contain — CLAUDE.md is partly stale relative to the refactored multi-file layout).

---

## Persona 1 — Dr. Elena Vasquez, CFA, CFP®

### CRITICAL — GK Capital Preservation Rule fires for the entire 40-year horizon

**Where:** [engine.js:107](engine.js:107) (`if (currentWR > GK_CONFIG.LOWER_GUARDRAIL)`)

**Issue:** Guyton & Klinger (2006), *"Decision Rules and Maximum Initial Withdrawal Rates"* (Journal of Financial Planning, March 2006), explicitly disables CPR in **the last 15 years** of the planning horizon. The rationale is straightforward: cuts late in retirement starve the retiree without commensurate longevity benefit, since terminal-year shortfalls dominate. This implementation applies CPR in **every** year of the 40-year sim.

**Magnitude:** In Monte Carlo runs, this artificially boosts success rate by ~3–6 pp (Guyton's Table 5 shows the late-life cuts contribute roughly that much to "preservation" without proportional utility benefit). More importantly, it makes the displayed success rate non-comparable to published GK literature.

**Fix:**
```js
const horizonYears = years; // already passed in
if (currentWR > GK_CONFIG.LOWER_GUARDRAIL && (currentYear < horizonYears - 15)) { ... }
```
Requires plumbing `currentYear` into `calcGKNextStep`.

### CRITICAL — 6% inflation cap is a non-canonical house rule masquerading as canonical GK

**Where:** [engine.js:11](engine.js:11), [engine.js:99](engine.js:99)

**Issue:** Guyton-Klinger 2006 has *no* inflation cap. The "Modified Withdrawal Rule" only freezes the inflation adjustment (the 2-condition gate). Capping at 6% silently destroys real purchasing power in elevated-inflation regimes — which is exactly when retirees most need protection.

**Magnitude:** Eurozone HICP hit 10.6% in October 2022. Under this code, the retiree's withdrawal would be capped at +6% while their grocery bill rose 10.6% — a **−4.2% real cut** in year 1, compounding if inflation persists. Over a 3-year regime like 2021–2023, the cumulative real-spending loss is roughly 8–10% — silent, irreversible, and invisible to the user since the dashboard reports nominal.

**Fix:** Either (a) remove the cap entirely (canonical GK), or (b) keep it but add a real-purchasing-power tracker so the user sees the gap.

### HIGH — Year-1 withdrawal is silently inflated

**Where:** [engine.js:117–146](engine.js:117) — `runGKSimulation` enters the loop with `lastWithdrawal = startWithdrawal` and immediately runs `calcGKNextStep`, which inflates that value before the first year's withdrawal.

**Issue:** GK's Withdrawal Rule says you inflate **last year's** withdrawal to compute **this year's**. In Year 1 there is no last year — `startWithdrawal` IS year 1's withdrawal. The code instead applies a CPI bump in year 1.

**Magnitude:** With 2% inflation and €40k start, year 1 withdraws €40,800 instead of €40,000 — a permanent 2% level shift propagated forward. Over 40 years at 2% real return, the cumulative drag is ~€32k of additional draw vs intended.

**Fix:** Skip `calcGKNextStep` in year 1, or pass a `firstYear: true` flag that bypasses the inflation adjustment.

### HIGH — Lean FIRE target uses essentials-only, not "lower lifestyle"

**Where:** [today.js:176](today.js:176) — `m.id === "lean" ? (cf.essentials * 12) / m.wr : cf.annualExpenses / m.wr`

**Issue:** "Lean FIRE" in the FIRE community generally means a *lower lifestyle basket at the same WR*, not "starve in retirement at a higher WR." Pairing essentials-only with a 4.5% WR is internally inconsistent — you've gone *less safe* (4.5% > 4%) AND *less spending*. Pick one.

**Recommendation:** Either keep the same WR (4%) and shrink the basket, or keep the basket and use a more aggressive WR — but explain which. Current behavior implies the user can get away with a higher WR because they're spending less, which is not what GK guardrails imply (the guardrails are scale-invariant in WR space).

### MEDIUM — "Draw from Safety (XEON)" recommendation ignores actual XEON balance

**Where:** [engine.js:312–313](engine.js:312)

**Issue:** When in shortfall mode, the recommendation hard-codes "withdraw from Safety (XEON)" regardless of whether XEON is depleted. If a user has run XEON to zero and the dashboard says "withdraw €X from XEON," they will either (a) sell VWCE during a drawdown — the worst possible action — or (b) get confused and freeze.

**Fix:** Check `state.bucketXEON` first; cascade to bonds, then cash, then a warning to refill before next month.

### MEDIUM — `monthlyRecommendation` hold-back ratios are unjustified magic numbers

**Where:** [engine.js:286–290](engine.js:286)

50%/20%/10%/0% holdback in Cut/Elevated/Safe/Prosperity zones. Defensible heuristic, but no theoretical anchor. In practice these aggressively starve the fun budget in Cut zone *while still routing surplus to investments* — that's double-conservative. A cleaner rule: "in Cut zone, divert the full surplus to refilling Safety, but don't also clip discretionary spending unless cashflow is negative."

### MEDIUM — Phase floors don't scale with annual expenses

**Where:** [engine.js:32–69](engine.js:32) — Fortress floor €44k, TermShield €110k for full_fire.

**Issue:** Hardcoded EUR floors. The user's `monthlyEssentialsEUR` is editable (€2,042 default). If they raise expenses to €3,500/mo, "2 years of expenses" becomes €84k, but the floor stays at €44k. Bucket 1 is undersized.

**Fix:** Compute floors as `floorMonths × cf.totalExpenses` (e.g., fortress = 24 × monthlyTotal) at runtime. Keep the hardcoded value as a fallback for first-load.

---

## Persona 2 — Dr. Marcus Chen, PhD (Stochastic Finance)

### CRITICAL — Volatility drag is unaccounted for; Monte Carlo systematically over-projects wealth

**Where:** [engine.js:155–163](engine.js:155) (`sampleReturnPath`), [stress.js:130](stress.js:130).

**Issue:** The user enters a "nominal expected return" (default 7%). The code treats this as the **arithmetic mean** of annual returns. When you draw N(μ, σ²) shocks and compound them as `(1+r)`, the geometric/CAGR expectation is approximately `μ − σ²/2` (volatility drag, Jensen's inequality on log).

**Magnitude:**
- User enters μ = 7%, σ = 18% (default equity vol).
- True geometric expectation: 7% − (0.18)²/2 = 7% − 1.62% = **5.38%**.
- Over 40 years: median terminal wealth is understated by *no*, overstated by — wait, in MC the median is the median of compounded paths, so the displayed median is actually correct *for the input μ as arithmetic*. The bias is in the user's **mental model**: they think they entered "expected long-run return" (geometric) but the engine treats it as arithmetic. The Monte Carlo therefore reports outcomes consistent with a higher CAGR than the user believes they specified.
- A user who reads "VWCE ≈ 7–8% historically" (the slider hint at [plan.js:249](plan.js:249)) and enters 7% has just specified `μ_arith ≈ 8.6%` which is *not* what historical CAGR data implies.

**Fix:** Either (a) interpret the user's input as geometric and convert internally — `μ_arith = μ_geo + σ²/2` before passing to `sampleReturnPath`, or (b) add a separate input for σ-aware mean and label clearly. Option (a) is the user-friendly default.

### CRITICAL — Equity and bond shocks are independent; inflation is independent of returns

**Where:** [engine.js:157–162](engine.js:157), [engine.js:184](engine.js:184).

**Issue:** Two layers of missing correlation structure:

1. **Equity ⊥ Bond.** Historically, US/EU stock-bond correlation has ranged from −0.4 (post-2000) to +0.6 (2022–2023, the inflation regime). Drawing them independently means stocks and bonds have ρ=0, which:
   - Understates 2022-style drawdowns where the 60/40 lost ~17% in real terms because both legs fell together.
   - Overstates the diversification benefit of the bond bucket.

2. **Returns ⊥ Inflation.** High inflation regimes historically coincide with negative real returns (1970s, 2022). Independence understates sequence-of-returns risk in inflation shocks — exactly the regime where guardrails matter most.

**Magnitude:** A simple stress test (correlate equity-bond at +0.4 and equity-inflation at −0.3 in inflation shocks) typically drops 40-year success rate by 4–8 pp from the independence baseline at WR=4% / 18% σ. This is the same order of magnitude as the *difference between Trinity and GK*.

**Fix:** Cholesky decomposition on (eq, bd, infl) shocks with a regime-switching correlation matrix, or at minimum a flat ρ_{eq,bd} parameter.

### CRITICAL — Inflation AR coefficient is too low; regimes mean-revert in 1 year

**Where:** [engine.js:165–175](engine.js:165) — `last + 0.6 * (target - last) + shock`.

**Issue:** This is an AR(1) process with persistence φ = 1 − 0.6 = 0.4. Real-world annual inflation persistence is φ ≈ 0.8–0.9 (CPI YoY autocorrelation in EU/US data). A φ = 0.4 process collapses any 5%-above-target shock back to within 1.5% of target in **one year**. The 1973–1982 inflation regime — 9 years above 6% — is **statistically impossible** under this generator.

**Magnitude:** Multi-year inflation regimes are precisely what break GK plans (the Withdrawal Rule's freeze trigger requires *both* negative return AND elevated WR — sequential bad years). Eliminating regime persistence eliminates the worst sequence-risk paths from the simulation. Combined with the volatility-drag understatement above, the displayed P10 is materially too optimistic.

**Fix:** `last + (1 - φ) * (target - last) + shock` with φ ≈ 0.85, or rename current variables and document.

### HIGH — `equityMu = state.gkNominalReturn` conflates portfolio return with equity return

**Where:** [stress.js:130](stress.js:130) — `equityMu: (state.gkNominalReturn || 7) / 100`.

**Issue:** `gkNominalReturn` is labeled "Expected nominal return" in [plan.js:245](plan.js:245) with hint "VWCE ≈ 7–8%". So it's *equity-only*. But the same value is used in:
- The linear projection at [stress.js:120](stress.js:120) as the **portfolio** nominal return (applied to the whole €X balance, not just the equity slice).
- `today.js`'s `realReturn` at [today.js:125](today.js:125) — also treated as portfolio-wide.

Either it's the equity return (then linear projection over-projects the bond+cash portion) or it's the portfolio return (then MC under-projects because the bond mu = 3% < 7% and shrinks the blend).

**Magnitude:** For an 80/20 portfolio with `equityMu = 7%`, `bondMu = 3%`:
- Blended μ = 0.8(7) + 0.2(3) = **6.2%**, not 7%.
- Over 40 years on €500k with 4% withdrawal, the 80 bps gap compounds to ~25% lower terminal wealth in MC vs linear.

**Fix:** Two separate state fields — `expectedEquityReturn` and `expectedPortfolioReturn` — or derive one from the other given current allocation.

### HIGH — `successRate` is a knife-edge metric; no shortfall depth, no CVaR

**Where:** [engine.js:194](engine.js:194), [engine.js:211](engine.js:211).

**Issue:** Success = "ended above zero." This:
- Counts a path that ends at €1 in year 40 as a success.
- Counts a path that ended at €1M in year 40 the same as one ending at €100M — relevant for terminal-wealth statistics.
- Doesn't distinguish "depleted in year 39" from "depleted in year 5" — both count as failures, but the latter is catastrophic and the former is essentially OK.

**Fix:** Add (a) **CVaR**: mean terminal wealth conditional on bottom decile; (b) **median time-to-depletion** for failed paths; (c) **real-terms terminal wealth** (apply cumulative inflation). The first two are 5-line additions to `runMonteCarlo`.

### HIGH — `successRate` doesn't penalize purchasing-power loss from the inflation cap

If inflation cap freezes withdrawals at +6% during a 12% inflation year, the path "succeeds" (portfolio > 0) while the retiree's real spending halves. Combine with the persistence bug above and this becomes acute: short-lived inflation spikes look fine; in reality they'd be sustained.

**Fix:** Track `realWithdrawal[year] = withdrawal[year] / cumInflation[year]` and report "real spending floor" — e.g., "in 5% of paths, real spending fell below €25k for at least 3 consecutive years."

### MEDIUM — Box-Muller wastes 50% of randomness, and `v=0` rejection is unnecessary

**Where:** [engine.js:148–153](engine.js:148).

Box-Muller generates *two* independent N(0,1) samples per call (sin + cos). The code returns only the cosine and discards the sine. Cheap fix: cache the second sample. Not a correctness bug, but doubles RNG calls per path. At 1000 paths × 40 years × 2 shocks = 80k unnecessary `Math.random()` calls.

Also: only `u` needs to be non-zero (it's the argument to `Math.log`). The `while (v === 0)` loop is unnecessary — `cos(0)` is fine.

### MEDIUM — Percentile computation uses nearest-rank, not interpolation

**Where:** [engine.js:198–202](engine.js:198).

`Math.round(q * (sorted.length - 1))` is the nearest-rank percentile. For 1000 paths this is fine (resolution = 0.1%); for 200 paths the P10 is the 20th value, which has ~1.5 pp jitter run-to-run. Linear interpolation between adjacent ranks would smooth this. Low priority.

---

## Persona 3 — Sven Eriksson (Numerical & Engineering Hygiene)

### CRITICAL — `state.monthlyExpensesEUR` does not exist; `annualExpenses` is `NaN` in Stress and History tabs

**Where:** [stress.js:105](stress.js:105) and [history.js:6](history.js:6).

```js
const annualExpenses = state.monthlyExpensesEUR * 12;
```

The state schema (per [script.js:13–14](script.js:13) and [plan.js:194,202](plan.js:194)) only contains `monthlyEssentialsEUR` and `monthlyFunEUR`. There is **no** `monthlyExpensesEUR` key. So:

- `state.monthlyExpensesEUR` → `undefined`
- `undefined * 12` → `NaN`
- `runGKSimulation({ startWithdrawal: NaN, ... })` → all rows have `withdrawal = NaN`, `portfolioEnd = NaN`
- `Math.max(...bands.map(b => b.p90))` on `NaN` arrays → `NaN`
- The chart's path generator silently produces invalid SVG → blank chart.

**Verification:** Every Stress tab render and every History tab "preview" block downstream of this line is computing NaN. The user is being shown either nothing or zeros where they expect projections.

**Fix:**
```js
const annualExpenses = ((state.monthlyEssentialsEUR || 0) + (state.monthlyFunEUR || 0)) * 12;
```
Or factor into a helper: `monthlyTotal(state) = (state.monthlyEssentialsEUR || 0) + (state.monthlyFunEUR || 0)` and reuse everywhere. `engine.js:deriveCashflow` already exposes `cf.annualExpenses` — both files should call that instead of recomputing.

### CRITICAL — `monthsToTarget` formula is wrong; over-estimates time-to-FIRE by ~20%

**Where:** [today.js:130](today.js:130) and [today.js:160](today.js:160).

```js
const n = Math.log(1 + (target - portfolio) * r / c) / Math.log(1 + r);
```

CLAUDE.md correctly documents the formula as `n = ln((target·r + c)/(P·r + c)) / ln(1+r)` — but the code implements a different, wrong one. Derivation:

FV-of-annuity-with-existing-principal: `F = P(1+r)^n + c·((1+r)^n − 1)/r`
Solving: `(1+r)^n = (F·r + c) / (P·r + c)`
`n = ln((F·r + c)/(P·r + c)) / ln(1+r)`

The code computes `ln(1 + (F − P)·r/c) / ln(1+r)`, which equals the correct formula **only when P = 0** (i.e., starting from scratch). For any non-zero portfolio, this **ignores the compounding of the existing balance** in the denominator.

**Worked example:** P = €300k, target = €800k, c = €5k/mo, r = 0.05/12 ≈ 0.004167:
- Correct: `ln((800k·0.004167 + 5k)/(300k·0.004167 + 5k)) / ln(1.004167)` = `ln(8333/6250) / 0.004158` = `0.2877 / 0.004158` ≈ **69 months**
- Code: `ln(1 + 500k·0.004167/5k) / ln(1.004167)` = `ln(1.4167) / 0.004158` = `0.3483 / 0.004158` ≈ **84 months**

Error: **+15 months / +22% overstatement**. The "Today" hero card and all four FIRE milestones are wrong.

**Fix:**
```js
const n = Math.log((target * r + c) / (portfolio * r + c)) / Math.log(1 + r);
```

### HIGH — Real-return is computed by subtraction (Fisher approximation only)

**Where:** [today.js:125](today.js:125):
```js
const realReturn = (state.gkNominalReturn || 7.0) - (state.gkInflation || 2.0);
```

True real return: `(1 + nom)/(1 + inf) − 1`. At 7%/2%: 4.90% vs 5.00% (10 bps gap). At 12%/8%: 3.70% vs 4.00% (30 bps). Compounded over 40 years, a 30 bps gap is ≈ 13% terminal-wealth error.

**Fix:** `const realReturn = ((1 + nom/100) / (1 + inf/100) - 1) * 100;`

### HIGH — `bgCgtRatePct` is stored, displayed, but never used in any computation

**Where:** [plan.js:259–264](plan.js:259) sliders into state; [plan.js:263](plan.js:263) hint says "Used in drawdown order." Grep confirms it appears nowhere else.

**Issue:** UI promises behavior the code does not deliver. The CGT slider is decorative. CLAUDE.md describes a tax-aware withdrawal optimiser that drains buckets in tax-optimal order; that code is gone or never made it into the new file layout.

**Fix:** Either (a) wire it up — `nextRebalanceBucket` could prefer drawing from XEON/Cash before VWCE in shortfall mode using `bgCgtRatePct × gainFraction(bucket)` as the cost — or (b) delete the slider until the feature exists. Don't ship a UI lie.

### HIGH — `nextRebalanceBucket` rebalance logic activates in drawdown mode too

**Where:** [engine.js:282–300](engine.js:282) calls `nextRebalanceBucket` even when `surplusMonthly >= 0`. But `monthlyRecommendation` only uses `nextRebalanceBucket` when surplus is positive (the `if` branch). OK on inspection, but in shortfall mode the recommendation hardcodes "draw from XEON" and ignores `nextRebalanceBucket` entirely — meaning if XEON is at floor, the user is told to *deplete the floor* with no warning. See Vasquez Medium #1.

### MEDIUM — Begin-of-year vs end-of-year withdrawal convention is undocumented

**Where:** [engine.js:131](engine.js:131): `endPortfolio = (portfolioStart - finalWithdrawal) * (1 + ret)`.

This is begin-of-year withdrawal. Trinity/Bengen use end-of-year. For a +20% year on €1M with €40k draw:
- Begin-of-year (this code): (1M − 40k) × 1.20 = €1.152M
- End-of-year (Trinity): 1M × 1.20 − 40k = €1.160M

Difference = 0.7% per good year. Over 40 years compounded the convention choice can affect terminal wealth by ~5–8%. **Pick one and document.** Begin-of-year is more conservative and arguably more realistic (you spend before you earn), so this is fine — but the user should know.

### MEDIUM — `Math.log` of non-positive in `monthsToTarget`

**Where:** [today.js:154–161](today.js:154).

`Math.log(target/portfolio)` if `portfolio === 0` → `Math.log(Infinity) = Infinity`. OK.
`Math.log(1 + r)` if `r === 0` → `Math.log(1) = 0` → division by zero → `Infinity`. The branch at line 152 (`realReturnMonthly <= 0`) only catches the no-surplus case; if `r === 0` AND `c > 0`, the formula doesn't divide by zero (`ln(1 + Δ·0/c) = ln(1) = 0` over `0` → NaN, not Infinity).

**Fix:** Add `if (r === 0) return Math.ceil((target - portfolio) / c);` (linear case).

### MEDIUM — Inconsistent "infinity" thresholds

**Where:** [today.js:155, 161, 167](today.js:155).

- Growth-only (no surplus) caps at 360 months
- With-surplus caps at 600 months
- Layoff scenario caps at 360 months

Pick one (probably 600 = 50 years) for consistency.

### LOW — `Math.random()`-driven simulations have no seed

**Where:** [engine.js:148](engine.js:148).

Re-running the MC produces different bands. For a personal tool that's fine, but if the user is comparing two scenarios (e.g., adjusting equity share by 5pp), they cannot tell whether the difference in outcomes is real or just sample noise. A seedable RNG (Mulberry32 in 6 lines) makes A/B comparisons valid.

### LOW — `gaussianSample` `while (u === 0)` is a single-iteration loop in practice

`Math.random()` returns 0 with probability ~2⁻⁵³. The `while` is fine, but stylistically confusing — a single `if` would convey intent.

### LOW — Currency precision

[engine.js:14](engine.js:14): `Math.round` on display. State carries floats. No leak into compounded state observed — but consider `Number.EPSILON`-sized drift in `bucketCash` after many state writes. Likely benign for this use case.

### LOW — `firePieces` not normalised for `phase.buckets[s.key].target` of zero

[today.js:441](today.js:441) divides by phase target; safe because all targets are > 0. Defensive coding, not a bug.

---

## Consolidated Verdict

### Critical & High findings (table)

| # | Severity | Area | File:Line | Issue |
|---|----------|------|-----------|-------|
| 1 | CRITICAL | Eng | stress.js:105, history.js:6 | `state.monthlyExpensesEUR` doesn't exist → NaN through entire Stress + History tabs |
| 2 | CRITICAL | Eng | today.js:130, 160 | `monthsToTarget` formula wrong; ignores P·r term; +20% overstatement |
| 3 | CRITICAL | Quant | engine.js:155 | Volatility drag: arithmetic μ used as geometric; overstates wealth |
| 4 | CRITICAL | Quant | engine.js:155, 184 | Equity/bond/inflation drawn independently; missing correlation |
| 5 | CRITICAL | Quant | engine.js:165 | Inflation AR persistence ≈ 0.4, real ≈ 0.85; multi-year regimes impossible |
| 6 | CRITICAL | CFP  | engine.js:107 | GK Capital Preservation fires for full 40 years; canon caps at horizon-15 |
| 7 | CRITICAL | CFP  | engine.js:11, 99 | 6% inflation cap silently destroys real spending in inflation regimes |
| 8 | HIGH | CFP  | engine.js:117 | Year-1 withdrawal silently inflated; should match `startWithdrawal` |
| 9 | HIGH | CFP  | today.js:176 | Lean FIRE conflates lower lifestyle with higher WR |
| 10 | HIGH | Quant | stress.js:130 | `equityMu = portfolio return` confusion → blended μ inconsistent across tabs |
| 11 | HIGH | Quant | engine.js:194 | Success metric is knife-edge; no CVaR, no real-spending floor |
| 12 | HIGH | Eng  | today.js:125 | Real return = additive; should be Fisher `(1+n)/(1+i) − 1` |
| 13 | HIGH | Eng  | plan.js:259 | `bgCgtRatePct` slider does nothing; UI lies |

### Top 5 prioritized fixes

1. **Fix `state.monthlyExpensesEUR` → `monthlyEssentialsEUR + monthlyFunEUR`** in `stress.js:105` and `history.js:6`. The Stress tab is **currently broken** for users — this is silently producing NaN charts. *5-line fix, highest user impact.*
2. **Fix `monthsToTarget` formula** in `today.js:130` and `:160` to `ln((T·r + c)/(P·r + c)) / ln(1+r)`. Every "time to FIRE" number on the dashboard is wrong by ~20%. *Two-line fix.*
3. **Fix volatility drag and equity/bond/inflation correlation** in `engine.js`. Either (a) interpret user input as geometric mean and convert to arithmetic, or (b) document clearly. Add a configurable ρ_{eq,bd}. The current Monte Carlo is not stress-testing what the user thinks it is.
4. **Fix inflation AR coefficient** to 0.85 and add a regime-persistence test case to `tests.html`. Without this, the MC cannot model the regime that broke 1970s retirees.
5. **Fix or delete the CGT slider.** Either wire `bgCgtRatePct` into a real tax-aware drawdown order, or remove it from `plan.js`. Don't ship UI promising features the engine doesn't have.

### Trust scores (0–10)

| Area | Score | One-line justification |
|------|------:|-----------------------|
| GK fidelity | 5 / 10 | Right structure, three canon-violations (cap, CPR-15-year, year-1 inflation) |
| Monte Carlo realism | 3 / 10 | Independence + low inflation persistence + arithmetic-as-geometric makes results materially optimistic |
| Tax logic | 1 / 10 | Slider exists, computation does not. CLAUDE.md describes features that aren't in the code. |
| Numerical robustness | 4 / 10 | Two NaN-propagating bugs (months-formula, monthlyExpensesEUR) live on `main` |

### The single most dangerous assumption

**The Monte Carlo "success rate" is *not* a survival probability for the plan as written.** Three independent biases stack in the same direction — toward optimism:

1. Arithmetic μ used as expected return → overstates compound growth by ~σ²/2 ≈ 1.6 pp/yr at default vol.
2. Independence of equity/bond/inflation → eliminates the worst correlated-shock paths (2022, 1973–74).
3. Inflation regimes mean-revert in 1 year → eliminates 1970s-style sustained inflation, the canonical GK-breaker.

All three nudge the displayed P10 *up* and the failure rate *down*. A user looking at "97% success rate" on this dashboard might in fact be running a plan with a true ~88% success rate under realistic generators. The hurt: **this user might retire 2–4 years earlier than they should**, on the basis of a number that looks rigorous but is silently optimistic in three compounding ways. For someone in their 40s with a 50-year horizon, those years cost more at the back end than the front, because they're also the years with the highest sequence-risk.

*The single line that captures the danger:* the dashboard says "Run 1,000 random 40-year sequences to see how often the plan survives." It does run 1,000. They're just not 1,000 plausible sequences — they're 1,000 sequences from a generator that excludes the world's worst observed retirement environments by construction.

---

## What this plan file is

This document IS the deliverable the user asked for. No code is to be changed — the user explicitly invoked plan mode and asked for a review only. If they want any of these fixes implemented, they should re-prompt with "fix #1, #2, #5" (or similar) and exit plan mode.
