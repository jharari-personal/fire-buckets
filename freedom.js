// ─── FREEDOM tab — financial independence lens + scenario modeler ───
// Story: where you stand → when you exit → what you earn after → how long it lasts

const { useMemo } = React;

const EMPLOYMENT_START = new Date(2026, 0, 1); // Jan 1 2026

// ─── Drawdown chart (pure SVG, responsive width) ───
// defenseOnly=true: shows only Cash+XEON+Bonds scaled to those buckets (Fix 13)
function DrawdownChart({ bucketSeries, transitions, months, isMobile, defenseOnly }) {
  const containerRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(0);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerW(e.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const padL = 54, padR = 14, padT = 14, padB = 28;
  const w = containerW || (isMobile ? 340 : 680);
  const h = 200;
  const n = bucketSeries.length;
  if (n === 0) return null;

  const displayKeys = defenseOnly ? ["cash", "xeon", "bonds"] : ["cash", "xeon", "bonds", "vwce"];
  const displayColors = defenseOnly
    ? [BUCKET_META.cash.raw, BUCKET_META.fortress.raw, BUCKET_META.termShield.raw]
    : [BUCKET_META.cash.raw, BUCKET_META.fortress.raw, BUCKET_META.termShield.raw, BUCKET_META.growth.raw];

  const maxV = defenseOnly
    ? Math.max(...bucketSeries.map(s => s.cash + s.xeon + s.bonds), 1)
    : Math.max(...bucketSeries.map(s => s.total), 1);

  const xs = (i) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  const ys = (v) => padT + (h - padT - padB) * (1 - v / maxV);

  const areas = displayKeys.map((key, ki) => {
    const baseline = bucketSeries.map((s) => {
      let base = 0;
      for (let j = 0; j < ki; j++) base += s[displayKeys[j]];
      return base;
    });
    const top = baseline.map((b, i) => b + bucketSeries[i][key]);
    const topPath = top.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
    const botPath = baseline.slice().reverse().map((v, i) => `L${xs(n - 1 - i)},${ys(v)}`).join(" ");
    return { path: `${topPath} ${botPath} Z`, color: displayColors[ki], key };
  });

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (i / yTicks) * maxV);
  const xLabelInterval = months <= 60 ? 12 : 24;

  return (
    <div ref={containerRef} style={{ width: "100%" }}>
      {containerW > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", width: "100%" }}>
          {tickVals.map((v, i) => (
            <g key={i}>
              <line x1={padL} y1={ys(v)} x2={w - padR} y2={ys(v)} stroke="var(--hairline)" strokeWidth={1} strokeDasharray={i === 0 ? "" : "2 4"} />
              <text x={padL - 8} y={ys(v) + 4} fontSize={10} fill="var(--fg-soft)" textAnchor="end" fontFamily="var(--font-mono)">{fmtEurK(v)}</text>
            </g>
          ))}
          {areas.map(a => (
            <path key={a.key} d={a.path} fill={a.color} opacity={0.45} />
          ))}
          {transitions.filter(t => t.month > 0 && t.month < months).map((t, i) => (
            <g key={i}>
              <line x1={xs(t.month)} y1={padT} x2={xs(t.month)} y2={h - padB} stroke="var(--fg-soft)" strokeWidth={1} strokeDasharray="4 3" />
              <text x={xs(t.month) + 4} y={padT + 12 + i * 13} fontSize={9} fill="var(--fg-mute)" fontFamily="var(--font-mono)">{t.label}</text>
            </g>
          ))}
          {Array.from({ length: Math.floor(months / xLabelInterval) + 1 }, (_, i) => i * xLabelInterval).filter(m => m <= months).map(m => (
            <text key={m} x={xs(m)} y={h - 8} fontSize={10} fill="var(--fg-soft)" textAnchor="middle" fontFamily="var(--font-mono)">
              {m === 0 ? "Exit" : m >= 12 ? `${Math.floor(m / 12)}y` : `${m}m`}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

// ─── Sensitivity Matrix ───
function SensitivityGrid({ exitPortfolio, currentSpend, currentIncome, isMobile }) {
  const spendSteps = [18000, 20000, 22000, 24000, 26000, 28000, 30000];
  const incomeSteps = [0, 3000, 6000, 9000, 12000, 15000, 18000, 21000, 24000];

  const cellColor = (wr) => {
    if (wr <= 0) return "rgba(122,162,255,0.18)";
    if (wr <= 3.2) return "rgba(108,212,154,0.22)";
    if (wr <= 4.0) return "rgba(108,212,154,0.12)";
    if (wr <= 4.8) return "rgba(245,184,107,0.18)";
    return "rgba(239,115,115,0.18)";
  };
  const textColor = (wr) => {
    if (wr <= 0) return "var(--accent)";
    if (wr <= 3.2) return "var(--good)";
    if (wr <= 4.0) return "var(--good)";
    if (wr <= 4.8) return "var(--warn)";
    return "var(--bad)";
  };

  const closestSpend = spendSteps.reduce((a, b) => Math.abs(b - currentSpend) < Math.abs(a - currentSpend) ? b : a);
  const closestIncome = incomeSteps.reduce((a, b) => Math.abs(b - currentIncome) < Math.abs(a - currentIncome) ? b : a);

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", width: "100%" }}>
      <table style={{ borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: isMobile ? 10 : 11, width: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th style={{ padding: 4, fontSize: 9, color: "var(--fg-soft)", textAlign: "right", width: isMobile ? 44 : "auto" }}>Income↓ Spend→</th>
            {spendSteps.map(s => (
              <th key={s} style={{ padding: 4, color: "var(--fg-mute)", fontWeight: 500, textAlign: "center" }}>
                {fmtEurK(s)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incomeSteps.map(income => (
            <tr key={income}>
              <td style={{ padding: "4px 6px", color: "var(--fg-mute)", fontWeight: 500, textAlign: "right" }}>
                {fmtEurK(income)}
              </td>
              {spendSteps.map(spend => {
                const gap = Math.max(0, spend - income);
                const wr = exitPortfolio > 0 ? (gap / exitPortfolio) * 100 : 0;
                const isHighlighted = spend === closestSpend && income === closestIncome;
                return (
                  <td key={spend} style={{
                    textAlign: "center", padding: isMobile ? 4 : 8,
                    background: cellColor(wr),
                    color: textColor(wr),
                    fontWeight: isHighlighted ? 700 : 400,
                    border: isHighlighted ? "2px solid var(--accent)" : "1px solid var(--hairline)",
                    borderRadius: 4,
                  }}>
                    {wr <= 0 ? "0%" : `${wr.toFixed(1)}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Coverage chip — compact % card for the independence snapshot ───
function CoverageChip({ label, coveragePct, gap }) {
  const color = coveragePct >= 100 ? "var(--good)" : coveragePct >= 70 ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ padding: "16px 18px", background: "var(--surface-2)", borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: "var(--fg-soft)", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>
        {coveragePct.toFixed(0)}<span style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-soft)" }}>%</span>
      </div>
      {gap > 0 && <div style={{ fontSize: 11, color, marginTop: 4 }}>{fmtEur(gap)}/mo gap</div>}
      {gap === 0 && <div style={{ fontSize: 11, color: "var(--good)", marginTop: 4 }}>Fully covered</div>}
    </div>
  );
}

// ─── Read-only income source row for Section 3 ───
function ReadOnlyIncomeRow({ label, enabled, amt, dur }) {
  return (
    <div style={{ opacity: enabled ? 1 : 0.4 }}>
      <Row gap={10} align="center">
        <div style={{ width: 7, height: 7, borderRadius: 999, background: enabled ? "var(--good)" : "var(--fg-soft)", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: enabled ? "var(--fg)" : "var(--fg-soft)" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: enabled ? "var(--good)" : "var(--fg-soft)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
          {enabled
            ? `${fmtEur(amt)}/mo${dur < 600 ? ` · ${dur >= 12 ? `${(dur / 12).toFixed(1)}yr` : `${dur}mo`}` : ""}`
            : "Disabled"}
        </span>
      </Row>
    </div>
  );
}

// ─── Main View ───
function FreedomView({ state, setState }) {
  const updateState = (k, v) => setState(s => ({ ...s, [k]: v }));
  const { isMobile, isDesktop } = useViewport();
  const cf = deriveCashflow(state);
  const portfolio = (state.bucketVWCE || 0) + (state.bucketXEON || 0) + (state.bucketFixedIncome || 0) + (state.bucketCash || 0);

  // ── Section 1: Employment Countdown ──
  const now = new Date();
  const daysSinceStart = Math.max(0, Math.floor((now - EMPLOYMENT_START) / 86400000));
  const monthsSinceStart = daysSinceStart / 30.44;
  const earnedSinceStart = monthsSinceStart * (state.monthlySalaryEUR || 0);
  const investedSinceStart = monthsSinceStart * Math.max(0, cf.surplusMonthly);

  const extraMonths = state.extraMonths || 0;
  const primaryOnlySurplus = Math.max(0, cf.primarySalary - cf.totalExpenses);
  const extraInvested = extraMonths * primaryOnlySurplus;
  const projectedPortfolio = portfolio + extraInvested;

  // ── Section 2: Exit Scenario ──
  const exitMonthsOut = state.exitMonthsOut ?? 3;
  const severanceMonths = state.severanceMonths || 0;
  const bonusEnabled = state.bonusEnabled || false;
  const bonusAmount = state.bonusAmount || 0;
  const vacationDays = state.vacationDays || 0;

  const monthsUntilExit = exitMonthsOut;
  const portfolioGrowth = monthsUntilExit * Math.max(0, cf.surplusMonthly);
  const severanceEUR = severanceMonths * (state.monthlySalaryEUR || 0);
  const dailyRate = (state.monthlySalaryEUR || 0) / 21.7;
  const vacationEUR = vacationDays * dailyRate;
  const lumpSum = severanceEUR + (bonusEnabled ? bonusAmount : 0) + vacationEUR;
  const exitPortfolio = portfolio + portfolioGrowth + lumpSum;

  const exitDate = new Date(now.getFullYear(), now.getMonth() + exitMonthsOut, 1);
  const exitLabel = exitDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  const worstCase = portfolio + portfolioGrowth;
  const bestCase12 = portfolio + portfolioGrowth + 12 * (state.monthlySalaryEUR || 0) + bonusAmount + 30 * dailyRate;

  // ── Section 3: Hybrid Income ──
  // Partner income: amount from Plan (read-only), toggle + duration are scenario-specific
  const partnerAmt = state.monthlySalaryPartnerEUR || 0;
  const partnerIncluded = state.partnerIncludedInScenario !== false;
  const partnerDur = state.partnerDurScenario || 600;

  // All income sources read from global state — configured in Plan tab (except partner controls)
  const incomeSources = [
    { enabled: state.freelanceEnabled || false, amt: state.freelanceAmt || 0, dur: state.freelanceDur || 600 },
    { enabled: state.parttimeEnabled || false,  amt: state.parttimeAmt || 0,  dur: state.parttimeDur || 600 },
    { enabled: partnerIncluded,                 amt: partnerAmt,              dur: partnerDur },
    { enabled: state.passiveEnabled || false,   amt: state.passiveAmt || 0,   dur: state.passiveDur || 600 },
  ];

  // "Current" hybrid income (month 0) — used for summary stats
  const hybridIncome = incomeSources.reduce((s, src) => s + (src.enabled ? src.amt : 0), 0);
  // Helper: income at month m post-exit
  const incomeAtMonth = (m) => incomeSources.reduce((s, src) => {
    if (!src.enabled) return s;
    if (src.dur < 600 && m >= src.dur) return s;
    return s + src.amt;
  }, 0);
  // Duration-aware income averaged over 10-year planning horizon
  const avgMonthlyIncome = Array.from({ length: 120 }, (_, m) => incomeAtMonth(m))
    .reduce((s, v) => s + v, 0) / 120;

  const scenarioExpenses = (state.monthlyEssentialsEUR || 0) + (state.monthlyFunEUR || 0);
  // Snapshot gap for drawdown subtitle ("Drawing X/mo initially")
  const snapshotGap = Math.max(0, scenarioExpenses - hybridIncome);
  const monthlyGap = Math.max(0, scenarioExpenses - avgMonthlyIncome);
  const annualGap = monthlyGap * 12;
  const effectiveWR = exitPortfolio > 0 ? (annualGap / exitPortfolio) * 100 : 0;
  const wrZone = getGKZone(effectiveWR);

  const safeMonthly = exitPortfolio * GK_CONFIG.IWR / 12;
  const essentialsCoverage = (state.monthlyEssentialsEUR || 0) > 0 ? (safeMonthly / (state.monthlyEssentialsEUR || 0)) * 100 : 0;
  const lifestyleCoverage = scenarioExpenses > 0 ? (safeMonthly / scenarioExpenses) * 100 : 0;

  const fullFireTarget = (scenarioExpenses * 12) / GK_CONFIG.IWR;
  const adjustedFireTarget = annualGap > 0 ? annualGap / GK_CONFIG.IWR : 0;

  // ── Section 4: Drawdown sequencer (duration-aware) ──
  const hasAnyIncome = incomeSources.some(s => s.enabled && s.amt > 0);

  const drawdownData = useMemo(() => {
    const anyGapExists = Array.from({ length: 121 }, (_, m) => Math.max(0, scenarioExpenses - incomeAtMonth(m))).some(g => g > 0);
    if (!anyGapExists) return { series: [], transitions: [], months: 0 };

    const pctVWCE = portfolio > 0 ? (state.bucketVWCE || 0) / portfolio : 0.84;
    const pctXEON = portfolio > 0 ? (state.bucketXEON || 0) / portfolio : 0.07;
    const pctBonds = portfolio > 0 ? (state.bucketFixedIncome || 0) / portfolio : 0.05;
    const pctCash = portfolio > 0 ? (state.bucketCash || 0) / portfolio : 0.04;

    let cash = exitPortfolio * pctCash;
    let xeon = exitPortfolio * pctXEON;
    let bonds = exitPortfolio * pctBonds;
    let vwce = exitPortfolio * pctVWCE;
    const monthlyGrowthRate = Math.pow(1 + (state.gkNominalReturn || 7) / 100, 1 / 12) - 1;

    const series = [];
    const transitions = [];
    const maxMonths = 120;
    let cashDepleted = false, xeonDepleted = false, bondsDepleted = false;

    for (let m = 0; m <= maxMonths; m++) {
      series.push({ cash: Math.max(0, cash), xeon: Math.max(0, xeon), bonds: Math.max(0, bonds), vwce: Math.max(0, vwce), total: Math.max(0, cash) + Math.max(0, xeon) + Math.max(0, bonds) + Math.max(0, vwce) });

      if (m === maxMonths) break;

      // Grow VWCE if not yet drawing from it
      if (cash > 0 || xeon > 0 || bonds > 0) {
        vwce *= (1 + monthlyGrowthRate);
      }

      // Month-specific gap accounting for income duration
      const gapThisMonth = Math.max(0, scenarioExpenses - incomeAtMonth(m));

      if (gapThisMonth <= 0) continue;

      // Draw cascade
      let draw = gapThisMonth;
      if (cash > 0) {
        const take = Math.min(draw, cash);
        cash -= take;
        draw -= take;
        if (cash <= 0 && !cashDepleted) {
          cashDepleted = true;
          transitions.push({ month: m + 1, label: `Cash out · mo ${m + 1}` });
        }
      }
      if (draw > 0 && xeon > 0) {
        const take = Math.min(draw, xeon);
        xeon -= take;
        draw -= take;
        if (xeon <= 0 && !xeonDepleted) {
          xeonDepleted = true;
          transitions.push({ month: m + 1, label: `XEON out · mo ${m + 1}` });
        }
      }
      if (draw > 0 && bonds > 0) {
        const take = Math.min(draw, bonds);
        bonds -= take;
        draw -= take;
        if (bonds <= 0 && !bondsDepleted) {
          bondsDepleted = true;
          transitions.push({ month: m + 1, label: `Bonds out · mo ${m + 1}` });
        }
      }
      if (draw > 0) {
        vwce -= draw;
      }

      if (vwce <= 0 && cash <= 0 && xeon <= 0 && bonds <= 0) {
        series.push({ cash: 0, xeon: 0, bonds: 0, vwce: 0, total: 0 });
        break;
      }
    }

    return { series, transitions, months: series.length - 1 };
  }, [exitPortfolio, state.monthlyEssentialsEUR, state.monthlyFunEUR,
      state.freelanceEnabled, state.freelanceAmt, state.freelanceDur,
      state.parttimeEnabled, state.parttimeAmt, state.parttimeDur,
      state.partnerIncludedInScenario, state.monthlySalaryPartnerEUR, state.partnerDurScenario,
      state.passiveEnabled, state.passiveAmt, state.passiveDur,
      state.bucketVWCE, state.bucketXEON, state.bucketFixedIncome, state.bucketCash, state.gkNominalReturn, portfolio]);

  // Derive runway from the drawdown simulation data (accounts for varying monthly gaps)
  const { cashRunway, xeonRunway, bondsRunway, totalDefensiveRunway } = useMemo(() => {
    if (drawdownData.series.length === 0) return { cashRunway: Infinity, xeonRunway: Infinity, bondsRunway: Infinity, totalDefensiveRunway: Infinity };
    const s = drawdownData.series;
    let cashR = Infinity, xeonR = Infinity, bondsR = Infinity, defR = Infinity;
    for (let m = 1; m < s.length; m++) {
      if (cashR === Infinity && s[m].cash <= 0 && s[0].cash > 0) cashR = m;
      if (xeonR === Infinity && s[m].xeon <= 0 && s[0].xeon > 0) xeonR = m;
      if (bondsR === Infinity && s[m].bonds <= 0 && s[0].bonds > 0) bondsR = m;
      if (defR === Infinity && s[m].cash <= 0 && s[m].xeon <= 0 && s[m].bonds <= 0) defR = m;
    }
    return { cashRunway: cashR, xeonRunway: xeonR, bondsRunway: bondsR, totalDefensiveRunway: defR };
  }, [drawdownData]);

  const fmtMonths = (n) => {
    if (n === 0 || n === Infinity) return n === 0 ? "0mo" : "∞";
    if (n < 12) return `${n}mo`;
    const y = Math.floor(n / 12);
    const m = n % 12;
    return m === 0 ? `${y}y` : `${y}y ${m}mo`;
  };

  // ── Render ──
  return (
    <Stack gap={isMobile ? 16 : 20}>

      {/* ─── Section 1: Employment Countdown ─── */}
      <Card>
        <SectionHeader
          title="Employment tracker"
          subtitle={`Since Jan 1, 2026 — ${daysSinceStart} days`}
        />
        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : "1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{daysSinceStart}</div>
            <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 4 }}>Days employed</div>
          </div>
          <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--good)", fontFamily: "var(--font-mono)" }}>{fmtEurK(earnedSinceStart)}</div>
            <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 4 }}>Gross earned</div>
          </div>
          <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{fmtEurK(investedSinceStart)}</div>
            <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 4 }}>Net invested</div>
          </div>
        </div>

        <PrecisionSlider
          label="What would N more months mean?"
          value={extraMonths} onChange={v => updateState("extraMonths", v)}
          min={0} max={24} step={1} suffix=" months"
          accent="var(--accent)"
          hint={extraMonths > 0
            ? `+${fmtEur(extraInvested)} invested (salary only) → portfolio reaches ${fmtEur(projectedPortfolio)}`
            : "Slide to project additional employment months (salary only, no compounding)"}
        />
      </Card>

      {/* ─── Sections 2+3: two-col on desktop (Fix 20) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: isMobile ? 16 : 20, alignItems: "start" }}>

      {/* ─── Section 2: Exit Scenario Simulator ─── */}
      <Card>
        <SectionHeader
          title="Exit scenario simulator"
          subtitle="When do you leave, and with what package?"
        />

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 16 }}>
          <PrecisionSlider
            label="Exit timing"
            value={exitMonthsOut} onChange={v => updateState("exitMonthsOut", v)}
            min={0} max={24} step={1}
            format={v => {
              const d = new Date(now.getFullYear(), now.getMonth() + v, 1);
              return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
            }}
            accent="var(--accent)"
            hint={`${exitMonthsOut} month${exitMonthsOut !== 1 ? "s" : ""} from now`}
          />
          <PrecisionSlider
            label="Severance"
            value={severanceMonths} onChange={v => updateState("severanceMonths", v)}
            min={0} max={12} step={1}
            format={v => `${v} mo (${fmtEurK(v * (state.monthlySalaryEUR || 0))})`}
            accent="var(--warn)"
            hint="Months of salary as severance"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <Row gap={12} align="center" style={{ marginBottom: 8 }}>
              <Toggle value={bonusEnabled} onChange={v => updateState("bonusEnabled", v)} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>Bonus payout</span>
            </Row>
            {bonusEnabled && (
              <NumberField
                label="Bonus amount"
                value={bonusAmount} onChange={v => updateState("bonusAmount", v)}
                min={0} max={100000} step={500} prefix="€"
                format={v => fmtEur(v)}
              />
            )}
          </div>
          <NumberField
            label="Unpaid vacation days"
            value={vacationDays} onChange={v => updateState("vacationDays", v)}
            min={0} max={60} step={1}
            format={v => `${v} days (${fmtEur(v * dailyRate)})`}
          />
        </div>

        {/* Exit result */}
        <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: isMobile ? 16 : 20 }}>
          <div style={{ fontSize: 11, color: "var(--fg-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
            Portfolio at exit · {exitLabel}
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", marginBottom: 12 }}>
            {fmtEur(exitPortfolio)}
          </div>

          {/* Independence snapshot — immediately under the headline number (Fix 10) */}
          {/* One-big + two-small layout (Fix 11) */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ padding: "16px 18px", background: "var(--surface-1)", borderRadius: 12, borderLeft: "3px solid var(--accent)" }}>
              <div style={{ fontSize: 11, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Portfolio safely provides</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", marginTop: 4, letterSpacing: "-0.02em" }}>
                {fmtEur(safeMonthly)}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-soft)" }}>/mo</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 6 }}>at 4% initial WR · {fmtEur(safeMonthly * 12)}/yr</div>
            </div>
            <CoverageChip
              label="Essentials"
              coveragePct={essentialsCoverage}
              gap={Math.max(0, (state.monthlyEssentialsEUR || 0) - safeMonthly)}
            />
            <CoverageChip
              label="Full lifestyle"
              coveragePct={lifestyleCoverage}
              gap={Math.max(0, scenarioExpenses - safeMonthly)}
            />
          </div>

          {/* Detail row — pushed below coverage (Fix 10) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Current</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-mute)", fontFamily: "var(--font-mono)" }}>{fmtEurK(portfolio)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Growth ({exitMonthsOut}mo)</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--good)", fontFamily: "var(--font-mono)" }}>+{fmtEurK(portfolioGrowth)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Lump sum</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--warn)", fontFamily: "var(--font-mono)" }}>+{fmtEurK(lumpSum)}</div>
            </div>
          </div>
          {/* Fix 12: rename "Range" to "Best case if negotiated" */}
          <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5 }}>
            Best case if you negotiate: <strong style={{ color: "var(--fg)" }}>{fmtEur(bestCase12)}</strong> (12mo severance + bonus + 30 days)
          </div>
        </div>
      </Card>

      {/* ─── Section 3: Hybrid Income Model ─── */}
      <Card>
        <SectionHeader
          title="Hybrid income model"
          subtitle="Income after leaving work — configure sources in the Plan tab. The portfolio only needs to cover the gap."
        />

        {/* Fix 15: killer insight callout — shown when hybrid income actually reduces the FIRE target */}
        {monthlyGap > 0 && adjustedFireTarget < fullFireTarget && (() => {
          const savings = fullFireTarget - adjustedFireTarget;
          const yearsSaved = cf.surplusMonthly > 0 ? savings / (cf.surplusMonthly * 12) : 0;
          return (
            <div style={{
              marginBottom: 20,
              padding: isMobile ? 16 : 20,
              background: "linear-gradient(180deg, var(--good-soft), transparent)",
              borderRadius: 12,
              border: "1px solid rgba(108,212,154,0.30)",
            }}>
              <Row justify="space-between" align="flex-start" gap={20} wrap={isMobile}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--good)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 6 }}>
                    With hybrid income
                  </div>
                  <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
                    Your FIRE target drops by <span style={{ color: "var(--good)", fontFamily: "var(--font-mono)" }}>{fmtEur(savings)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg-mute)", marginTop: 8, lineHeight: 1.5 }}>
                    From <strong style={{ fontFamily: "var(--font-mono)", color: "var(--fg-mute)" }}>{fmtEur(fullFireTarget)}</strong> to <strong style={{ fontFamily: "var(--font-mono)", color: "var(--good)" }}>{fmtEur(adjustedFireTarget)}</strong>
                    {yearsSaved > 0.1 && <>. That's ~{yearsSaved.toFixed(1)} years off your timeline at your current savings rate.</>}
                  </div>
                </div>
                <div style={{
                  padding: "12px 16px", background: "var(--surface-1)", borderRadius: 12,
                  border: "1px solid var(--hairline)", textAlign: "center", minWidth: 100,
                }}>
                  <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>Effective WR</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: wrZone.color, fontFamily: "var(--font-mono)", marginTop: 4 }}>
                    {effectiveWR.toFixed(1)}%
                  </div>
                </div>
              </Row>
            </div>
          );
        })()}

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 20, marginBottom: 20 }}>
          {/* Income sources — read-only from Plan, partner toggle/duration editable here */}
          <Stack gap={14}>
            <Row justify="space-between" align="center">
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Income sources</div>
              <Pill tone="ghost" size="xs">Edit in Plan</Pill>
            </Row>

            {/* Fix 16: only show enabled sources */}
            {(state.freelanceEnabled || false) && (
              <ReadOnlyIncomeRow
                label="Freelance / consulting"
                enabled={true}
                amt={state.freelanceAmt || 0}
                dur={state.freelanceDur || 600}
              />
            )}
            {(state.parttimeEnabled || false) && (
              <ReadOnlyIncomeRow
                label="Part-time employment"
                enabled={true}
                amt={state.parttimeAmt || 0}
                dur={state.parttimeDur || 600}
              />
            )}

            {/* Partner income — amount locked to Plan value, toggle + duration editable */}
            <div>
              <Row gap={12} align="center" style={{ marginBottom: partnerIncluded ? 8 : 0 }}>
                <Toggle value={partnerIncluded} onChange={v => updateState("partnerIncludedInScenario", v)} />
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>Partner income</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: partnerIncluded ? "var(--good)" : "var(--fg-soft)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
                  {partnerIncluded
                    ? `${fmtEur(partnerAmt)}/mo${partnerDur < 600 ? ` · ${partnerDur >= 12 ? `${(partnerDur / 12).toFixed(1)}yr` : `${partnerDur}mo`}` : ""}`
                    : "Excluded"}
                </span>
              </Row>
              {partnerIncluded && (
                <PrecisionSlider
                  label="Duration"
                  value={partnerDur}
                  onChange={v => updateState("partnerDurScenario", v)}
                  min={1} max={600} step={1}
                  format={v => v >= 600 ? "Indefinite" : v >= 12 ? `${(v / 12).toFixed(1)} years (${v}mo)` : `${v} months`}
                  accent="var(--fg-soft)"
                />
              )}
            </div>

            {(state.passiveEnabled || false) && (
              <ReadOnlyIncomeRow
                label="Passive / rental / other"
                enabled={true}
                amt={state.passiveAmt || 0}
                dur={state.passiveDur || 600}
              />
            )}
            {!state.freelanceEnabled && !state.parttimeEnabled && !state.passiveEnabled && !partnerIncluded && (
              <div style={{ fontSize: 12, color: "var(--fg-soft)", fontStyle: "italic" }}>No income sources enabled — configure in Plan tab.</div>
            )}
          </Stack>

          {/* Expenses — read-only from Plan */}
          <Stack gap={14}>
            <Row justify="space-between" align="center">
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Expenses</div>
              <Pill tone="ghost" size="xs">Edit in Plan</Pill>
            </Row>
            <div style={{ padding: "16px", background: "var(--surface-2)", borderRadius: 12 }}>
              <Stack gap={10}>
                <Row justify="space-between" align="baseline">
                  <span style={{ fontSize: 13, color: "var(--fg-mute)" }}>Monthly essentials</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(state.monthlyEssentialsEUR || 0)}</span>
                </Row>
                <Row justify="space-between" align="baseline">
                  <span style={{ fontSize: 13, color: "var(--fg-mute)" }}>Monthly fun</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(state.monthlyFunEUR || 0)}</span>
                </Row>
                <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
                  <Row justify="space-between" align="baseline">
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Total monthly</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(scenarioExpenses)}</span>
                  </Row>
                </div>
              </Stack>
            </div>
          </Stack>
        </div>

        {/* Results */}
        <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: isMobile ? 16 : 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Avg income</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--good)", fontFamily: "var(--font-mono)" }}>{fmtEur(avgMonthlyIncome)}</div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>avg/mo · 10yr</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Total expenses</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(scenarioExpenses)}</div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>/month</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Monthly gap</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: monthlyGap > 0 ? "var(--fg)" : "var(--good)", fontFamily: "var(--font-mono)" }}>
                {monthlyGap > 0 ? fmtEur(monthlyGap) : "Covered"}
              </div>
              {monthlyGap > 0 && <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>/month from portfolio</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Effective WR</div>
              <Row gap={6} align="baseline">
                <span style={{ fontSize: 18, fontWeight: 700, color: wrZone.color, fontFamily: "var(--font-mono)" }}>{fmtPct(effectiveWR)}</span>
                <Pill tone={wrZone.tone} size="sm">{wrZone.label}</Pill>
              </Row>
            </div>
          </div>

          {monthlyGap > 0 && (
            <div style={{ padding: "12px 14px", background: "var(--surface-1)", borderRadius: 10, fontSize: 13, color: "var(--fg-mute)", lineHeight: 1.6 }}>
              With avg income of <strong style={{ color: "var(--good)" }}>{fmtEur(avgMonthlyIncome)}/mo</strong>, your portfolio only needs to cover <strong style={{ color: "var(--fg)" }}>{fmtEur(monthlyGap)}/mo</strong>. Your real FIRE target drops from <strong>{fmtEur(fullFireTarget)}</strong> to <strong style={{ color: "var(--accent)" }}>{fmtEur(adjustedFireTarget)}</strong>.
            </div>
          )}
          {monthlyGap === 0 && avgMonthlyIncome > 0 && (
            <div style={{ padding: "12px 14px", background: "var(--good-soft)", borderRadius: 10, fontSize: 13, color: "var(--good)", lineHeight: 1.6 }}>
              Your hybrid income fully covers expenses. The portfolio compounds untouched — this is Coast FIRE.
            </div>
          )}
        </div>
      </Card>

      </div>{/* end 2-col grid */}

      {/* ─── Section 4: Bucket Drawdown Sequencer ─── */}
      <Card>
        <SectionHeader
          title="Bucket drawdown sequencer"
          subtitle={drawdownData.series.length > 0 ? `Drawing ${fmtEur(snapshotGap)}/mo initially — Cash → XEON → Bonds → VWCE` : "No drawdown needed — all buckets compound untouched"}
        />

        {drawdownData.series.length > 0 ? (() => {
          const vwceAtEnd = drawdownData.series.length > 0
            ? drawdownData.series[drawdownData.series.length - 1].vwce
            : 0;
          const fmtRunway = (v) => v === Infinity ? "∞" : v >= 12 ? `${(v / 12).toFixed(1)}y` : `${v}mo`;
          return (
            <>
              {/* Two-pane chart: defense-only (zoomed) + VWCE growth panel (Fix 13) */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--fg-soft)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Defense ladder</div>
                  <DrawdownChart
                    bucketSeries={drawdownData.series}
                    transitions={drawdownData.transitions}
                    months={drawdownData.months}
                    isMobile={isMobile}
                    defenseOnly
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--fg-soft)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Growth bucket (VWCE)</div>
                  <div style={{ padding: "16px", background: "var(--surface-2)", borderRadius: 12, height: "calc(100% - 28px)", display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>At exit</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: BUCKET_META.growth.raw, fontFamily: "var(--font-mono)" }}>{fmtEur(drawdownData.series[0]?.vwce || 0)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Compounding while defense is used</div>
                      <div style={{ fontSize: 13, color: "var(--fg-mute)", marginTop: 2, fontFamily: "var(--font-mono)" }}>at {fmtPct(state.gkNominalReturn || 7)} nominal</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>After defense ladder exhausted</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: vwceAtEnd > 0 ? BUCKET_META.growth.raw : "var(--bad)", fontFamily: "var(--font-mono)" }}>
                        {vwceAtEnd > 0 ? fmtEur(vwceAtEnd) : "Depleted"}
                        {vwceAtEnd > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-soft)" }}> projected</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Runway stepper (Fix 14) */}
              <div style={{
                display: "flex", alignItems: "stretch",
                background: "var(--surface-2)", borderRadius: 12,
                border: "1px solid var(--hairline)", overflow: "hidden",
              }}>
                {[
                  { label: "Cash only",    months: cashRunway,          color: BUCKET_META.cash.raw },
                  { label: "+ Safety",     months: xeonRunway,          color: BUCKET_META.fortress.raw },
                  { label: "+ Stability",  months: bondsRunway,         color: BUCKET_META.termShield.raw },
                  { label: "Then Growth",  months: vwceAtEnd > 0 ? Infinity : totalDefensiveRunway, color: BUCKET_META.growth.raw },
                ].map((step, i, arr) => (
                  <div key={i} style={{
                    flex: 1, padding: "14px 16px",
                    borderRight: i < arr.length - 1 ? "1px solid var(--hairline)" : "none",
                    borderLeft: `3px solid ${step.color}`,
                  }}>
                    <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>{step.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                      {fmtRunway(step.months)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          );
        })() : (
          <div style={{ padding: 20, background: "var(--good-soft)", borderRadius: 12, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--good)", marginBottom: 6 }}>No drawdown needed</div>
            <div style={{ fontSize: 13, color: "var(--fg-mute)" }}>
              All buckets compound untouched. At {fmtPct(state.gkNominalReturn || 7)} nominal return, your portfolio grows to approximately <strong style={{ color: "var(--fg)" }}>{fmtEur(exitPortfolio * Math.pow(1 + (state.gkNominalReturn || 7) / 100, 10))}</strong> in 10 years.
            </div>
          </div>
        )}
      </Card>

      {/* ─── Section 5: Sensitivity Matrix ─── */}
      <Card>
        <SectionHeader
          title="Sensitivity matrix"
          subtitle="Withdrawal rate by annual spend vs. income — green is safe, red is danger"
        />
        {/* Fix 17: "you are here" annotation */}
        {(() => {
          const currentSpendK = Math.round(scenarioExpenses * 12 / 1000);
          const currentIncomeK = Math.round(avgMonthlyIncome * 12 / 1000);
          const currentWR = effectiveWR;
          return (
            <Row gap={10} align="center" style={{ marginBottom: 12 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, border: "2px solid var(--accent)", background: "transparent", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "var(--fg-mute)" }}>
                You are here: <strong style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>€{currentSpendK}k</strong> spend / <strong style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>€{currentIncomeK}k</strong> income → <strong style={{ color: wrZone.color, fontFamily: "var(--font-mono)" }}>{currentWR.toFixed(1)}% WR</strong>
              </span>
            </Row>
          );
        })()}
        <SensitivityGrid
          exitPortfolio={exitPortfolio}
          currentSpend={scenarioExpenses * 12}
          currentIncome={avgMonthlyIncome * 12}
          isMobile={isMobile}
        />
        {/* Fix 17: gradient strip legend replacing the chip row */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", border: "1px solid var(--hairline)" }}>
            <div style={{ flex: 1, background: "rgba(122,162,255,0.45)" }} title="Coast (0%)" />
            <div style={{ flex: 1, background: "rgba(108,212,154,0.45)" }} title="Prosperity (<3.2%)" />
            <div style={{ flex: 1, background: "rgba(108,212,154,0.85)" }} title="Safe (<4%)" />
            <div style={{ flex: 1, background: "rgba(245,184,107,0.65)" }} title="Elevated (<4.8%)" />
            <div style={{ flex: 1, background: "rgba(239,115,115,0.65)" }} title="Cut zone (>4.8%)" />
          </div>
          <Row justify="space-between" style={{ marginTop: 4, fontSize: 10, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
            <span>Coast</span><span>3.2%</span><span>4.0%</span><span>4.8%</span><span>Cut</span>
          </Row>
        </div>
      </Card>

    </Stack>
  );
}

window.FreedomView = FreedomView;
