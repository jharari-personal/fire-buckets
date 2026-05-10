// ─── FREEDOM tab — financial independence lens + scenario modeler ───
// Story: where you stand → when you exit → what you earn after → how long it lasts

const { useState, useMemo, useCallback } = React;

const EMPLOYMENT_START = new Date(2026, 0, 1); // Jan 1 2026

// ─── Drawdown chart (pure SVG, responsive width) ───
function DrawdownChart({ bucketSeries, transitions, months, isMobile }) {
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
  const h = 240;
  const n = bucketSeries.length;
  if (n === 0) return null;

  const maxV = Math.max(...bucketSeries.map(s => s.total), 1);
  const xs = (i) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
  const ys = (v) => padT + (h - padT - padB) * (1 - v / maxV);

  const bucketKeys = ["cash", "xeon", "bonds", "vwce"];
  const colors = [BUCKET_META.cash.raw, BUCKET_META.fortress.raw, BUCKET_META.termShield.raw, BUCKET_META.growth.raw];

  const areas = bucketKeys.map((key, ki) => {
    const baseline = bucketSeries.map((s, i) => {
      let base = 0;
      for (let j = 0; j < ki; j++) base += s[bucketKeys[j]];
      return base;
    });
    const top = baseline.map((b, i) => b + bucketSeries[i][key]);
    const topPath = top.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
    const botPath = baseline.slice().reverse().map((v, i) => `L${xs(n - 1 - i)},${ys(v)}`).join(" ");
    return { path: `${topPath} ${botPath} Z`, color: colors[ki], key };
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
            <path key={a.key} d={a.path} fill={a.color} opacity={0.35} />
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

// ─── Toggle + Slider combo for income sources with optional duration ───
function IncomeSource({ label, enabled, onToggle, value, onChange, max, durationMonths, onDurationChange, isMobile }) {
  return (
    <div style={{ opacity: enabled ? 1 : 0.45, transition: "opacity 200ms" }}>
      <Row gap={12} align="center" style={{ marginBottom: enabled ? 8 : 0 }}>
        <Toggle value={enabled} onChange={onToggle} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{label}</span>
        {enabled && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--good)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>
            {fmtEur(value)}/mo{durationMonths < 600 ? ` × ${durationMonths}mo` : ""}
          </span>
        )}
      </Row>
      {enabled && (
        <Stack gap={6}>
          <PrecisionSlider
            label="" value={value} onChange={onChange}
            min={0} max={max} step={50} prefix="€" suffix="/mo"
            accent="var(--good)"
          />
          <PrecisionSlider
            label="Duration" value={durationMonths} onChange={onDurationChange}
            min={1} max={600} step={1}
            format={v => v >= 600 ? "Indefinite" : v >= 12 ? `${(v / 12).toFixed(1)} years (${v}mo)` : `${v} months`}
            accent="var(--fg-soft)"
          />
        </Stack>
      )}
    </div>
  );
}

// ─── Main View ───
function FreedomView({ state }) {
  const { isMobile, isDesktop } = useViewport();
  const cf = deriveCashflow(state);
  const portfolio = (state.bucketVWCE || 0) + (state.bucketXEON || 0) + (state.bucketFixedIncome || 0) + (state.bucketCash || 0);

  // ── Section 1: Employment Countdown ──
  const now = new Date();
  const daysSinceStart = Math.max(0, Math.floor((now - EMPLOYMENT_START) / 86400000));
  const monthsSinceStart = daysSinceStart / 30.44;
  const earnedSinceStart = monthsSinceStart * (state.monthlySalaryEUR || 0);
  const investedSinceStart = monthsSinceStart * Math.max(0, cf.surplusMonthly);

  const [extraMonths, setExtraMonths] = useState(0);
  const primaryOnlySurplus = Math.max(0, cf.primarySalary - cf.totalExpenses);
  const extraInvested = extraMonths * primaryOnlySurplus;
  const projectedPortfolio = portfolio + extraInvested;

  // ── Section 2: Exit Scenario ──
  const [exitMonthsOut, setExitMonthsOut] = useState(3);
  const [severanceMonths, setSeveranceMonths] = useState(0);
  const [bonusEnabled, setBonusEnabled] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [vacationDays, setVacationDays] = useState(0);

  const monthsUntilExit = exitMonthsOut;
  const portfolioGrowth = monthsUntilExit * Math.max(0, cf.surplusMonthly);
  const severanceEUR = severanceMonths * (state.monthlySalaryEUR || 0);
  const dailyRate = (state.monthlySalaryEUR || 0) / 21.7;
  const vacationEUR = vacationDays * dailyRate;
  const lumpSum = severanceEUR + (bonusEnabled ? bonusAmount : 0) + vacationEUR;
  const exitPortfolio = portfolio + portfolioGrowth + lumpSum;

  const exitDate = new Date(now.getFullYear(), now.getMonth() + exitMonthsOut, 1);
  const exitLabel = exitDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  // Best / worst case
  const worstCase = portfolio + portfolioGrowth;
  const bestCase12 = portfolio + portfolioGrowth + 12 * (state.monthlySalaryEUR || 0) + bonusAmount + 30 * dailyRate;

  // ── Section 3: Hybrid Income ──
  const [freelanceEnabled, setFreelanceEnabled] = useState(false);
  const [freelanceAmt, setFreelanceAmt] = useState(0);
  const [freelanceDur, setFreelanceDur] = useState(600);
  const [parttimeEnabled, setParttimeEnabled] = useState(false);
  const [parttimeAmt, setParttimeAmt] = useState(0);
  const [parttimeDur, setParttimeDur] = useState(600);
  const [partnerAmt, setPartnerAmt] = useState(state.monthlySalaryPartnerEUR || 0);
  const [partnerDur, setPartnerDur] = useState(600);
  const [passiveEnabled, setPassiveEnabled] = useState(false);
  const [passiveAmt, setPassiveAmt] = useState(0);
  const [passiveDur, setPassiveDur] = useState(600);
  const [scenarioEssentials, setScenarioEssentials] = useState(state.monthlyEssentialsEUR || 2000);
  const [scenarioFun, setScenarioFun] = useState(state.monthlyFunEUR || 200);

  // Income sources with durations — used by drawdown sequencer for month-by-month accuracy
  const incomeSources = [
    { enabled: freelanceEnabled, amt: freelanceAmt, dur: freelanceDur },
    { enabled: parttimeEnabled,  amt: parttimeAmt,  dur: parttimeDur },
    { enabled: true,             amt: partnerAmt,   dur: partnerDur },
    { enabled: passiveEnabled,   amt: passiveAmt,   dur: passiveDur },
  ];
  // "Current" hybrid income (month 0) — used for summary stats
  const hybridIncome = incomeSources.reduce((s, src) => s + (src.enabled ? src.amt : 0), 0);
  // Helper: income at month m post-exit
  const incomeAtMonth = (m) => incomeSources.reduce((s, src) => {
    if (!src.enabled) return s;
    if (src.dur < 600 && m >= src.dur) return s;
    return s + src.amt;
  }, 0);
  const scenarioExpenses = scenarioEssentials + scenarioFun;
  const monthlyGap = Math.max(0, scenarioExpenses - hybridIncome);
  const annualGap = monthlyGap * 12;
  const effectiveWR = exitPortfolio > 0 ? (annualGap / exitPortfolio) * 100 : 0;
  const wrZone = getGKZone(effectiveWR);

  const safeMonthly = exitPortfolio * GK_CONFIG.IWR / 12;
  const essentialsCoverage = scenarioEssentials > 0 ? (safeMonthly / scenarioEssentials) * 100 : 0;
  const lifestyleCoverage = scenarioExpenses > 0 ? (safeMonthly / scenarioExpenses) * 100 : 0;

  const fullFireTarget = (scenarioExpenses * 12) / GK_CONFIG.IWR;
  const adjustedFireTarget = annualGap > 0 ? annualGap / GK_CONFIG.IWR : 0;

  // ── Section 4: Drawdown sequencer (duration-aware) ──
  const hasAnyIncome = incomeSources.some(s => s.enabled && s.amt > 0);
  const needsDrawdown = monthlyGap > 0 || (hasAnyIncome && incomeSources.some(s => s.enabled && s.dur < 600));

  const drawdownData = useMemo(() => {
    // Check if any month in the horizon has a gap
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
  }, [exitPortfolio, scenarioExpenses, incomeSources, state.bucketVWCE, state.bucketXEON, state.bucketFixedIncome, state.bucketCash, state.gkNominalReturn, portfolio]);

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

  // ── Render ──
  return (
    <Stack gap={isMobile ? 16 : 20}>

      {/* ─── Section 1: Employment Countdown ─── */}
      <Card>
        <SectionHeader
          eyebrow="Countdown"
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
          value={extraMonths} onChange={setExtraMonths}
          min={0} max={24} step={1} suffix=" months"
          accent="var(--accent)"
          hint={extraMonths > 0
            ? `+${fmtEur(extraInvested)} invested (salary only) → portfolio reaches ${fmtEur(projectedPortfolio)}`
            : "Slide to project additional employment months (salary only, no compounding)"}
        />
      </Card>

      {/* ─── Section 2: Exit Scenario Simulator ─── */}
      <Card>
        <SectionHeader
          eyebrow="Exit"
          title="Exit scenario simulator"
          subtitle="When do you leave, and with what package?"
        />

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 16 }}>
          <PrecisionSlider
            label="Exit timing"
            value={exitMonthsOut} onChange={setExitMonthsOut}
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
            value={severanceMonths} onChange={setSeveranceMonths}
            min={0} max={12} step={1}
            format={v => `${v} mo (${fmtEurK(v * (state.monthlySalaryEUR || 0))})`}
            accent="var(--warn)"
            hint="Months of salary as severance"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <Row gap={12} align="center" style={{ marginBottom: 8 }}>
              <Toggle value={bonusEnabled} onChange={setBonusEnabled} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>Bonus payout</span>
            </Row>
            {bonusEnabled && (
              <NumberField
                label="Bonus amount"
                value={bonusAmount} onChange={setBonusAmount}
                min={0} max={100000} step={500} prefix="€"
                format={v => fmtEur(v)}
              />
            )}
          </div>
          <NumberField
            label="Unpaid vacation days"
            value={vacationDays} onChange={setVacationDays}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
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
          <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5 }}>
            Range: <strong style={{ color: "var(--fg)" }}>{fmtEur(worstCase)}</strong> (no package) to <strong style={{ color: "var(--fg)" }}>{fmtEur(bestCase12)}</strong> (12mo severance + bonus + 30 days)
          </div>
        </div>

        {/* Independence snapshot at exit */}
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : "1fr", gap: 12 }}>
          {/* Safe income */}
          <div style={{ padding: "14px 16px", background: "var(--surface-1)", borderRadius: 12, borderLeft: "3px solid var(--accent)" }}>
            <div style={{ fontSize: 11, color: "var(--fg-soft)", marginBottom: 4 }}>Portfolio safely provides</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{fmtEur(safeMonthly)}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-soft)" }}>/mo</span></div>
            <div style={{ fontSize: 10, color: "var(--fg-soft)", marginTop: 4 }}>at {fmtPct(GK_CONFIG.IWR * 100, 0)} initial WR</div>
          </div>
          {/* Essentials coverage */}
          {(() => {
            const essGap = Math.max(0, scenarioEssentials - safeMonthly);
            const essColor = essentialsCoverage >= 100 ? "var(--good)" : "var(--warn)";
            return (
              <div style={{ padding: "14px 16px", background: "var(--surface-1)", borderRadius: 12, borderLeft: `3px solid ${essColor}` }}>
                <Row justify="space-between" align="baseline">
                  <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Essentials</div>
                  <Pill tone={essentialsCoverage >= 100 ? "good" : "warn"} size="xs">{essentialsCoverage.toFixed(0)}%</Pill>
                </Row>
                <div style={{ fontSize: 18, fontWeight: 700, color: essColor, fontFamily: "var(--font-mono)", marginTop: 4 }}>
                  {fmtEur(Math.min(safeMonthly, scenarioEssentials))}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-soft)" }}> / {fmtEur(scenarioEssentials)}</span>
                </div>
                {essGap > 0 && <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 4 }}>Gap: {fmtEur(essGap)}/mo needs income</div>}
                {essGap === 0 && <div style={{ fontSize: 11, color: "var(--good)", marginTop: 4 }}>Fully covered by portfolio</div>}
              </div>
            );
          })()}
          {/* Full lifestyle coverage */}
          {(() => {
            const lifeGap = Math.max(0, scenarioExpenses - safeMonthly);
            const lifeColor = lifestyleCoverage >= 100 ? "var(--good)" : lifestyleCoverage >= 70 ? "var(--warn)" : "var(--bad)";
            return (
              <div style={{ padding: "14px 16px", background: "var(--surface-1)", borderRadius: 12, borderLeft: `3px solid ${lifeColor}` }}>
                <Row justify="space-between" align="baseline">
                  <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Full lifestyle</div>
                  <Pill tone={lifestyleCoverage >= 100 ? "good" : lifestyleCoverage >= 70 ? "warn" : "bad"} size="xs">{lifestyleCoverage.toFixed(0)}%</Pill>
                </Row>
                <div style={{ fontSize: 18, fontWeight: 700, color: lifeColor, fontFamily: "var(--font-mono)", marginTop: 4 }}>
                  {fmtEur(Math.min(safeMonthly, scenarioExpenses))}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-soft)" }}> / {fmtEur(scenarioExpenses)}</span>
                </div>
                {lifeGap > 0 && <div style={{ fontSize: 11, color: lifeColor, marginTop: 4 }}>Gap: {fmtEur(lifeGap)}/mo needs income</div>}
                {lifeGap === 0 && <div style={{ fontSize: 11, color: "var(--good)", marginTop: 4 }}>Fully covered by portfolio</div>}
              </div>
            );
          })()}
        </div>
      </Card>

      {/* ─── Section 3: Hybrid Income Model ─── */}
      <Card>
        <SectionHeader
          eyebrow="Post-exit"
          title="Hybrid income model"
          subtitle="What income sources do you have after leaving? The portfolio only needs to cover the gap."
        />

        <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: 20, marginBottom: 20 }}>
          <Stack gap={16}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Income sources</div>
            <IncomeSource label="Freelance / consulting" enabled={freelanceEnabled} onToggle={setFreelanceEnabled} value={freelanceAmt} onChange={setFreelanceAmt} max={8000} durationMonths={freelanceDur} onDurationChange={setFreelanceDur} isMobile={isMobile} />
            <IncomeSource label="Part-time employment" enabled={parttimeEnabled} onToggle={setParttimeEnabled} value={parttimeAmt} onChange={setParttimeAmt} max={6000} durationMonths={parttimeDur} onDurationChange={setParttimeDur} isMobile={isMobile} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", display: "block", marginBottom: 8 }}>Partner income</span>
              <PrecisionSlider label="" value={partnerAmt} onChange={setPartnerAmt} min={0} max={10000} step={50} prefix="€" suffix="/mo" accent="var(--good)" />
              <PrecisionSlider label="Duration" value={partnerDur} onChange={setPartnerDur} min={1} max={600} step={1} format={v => v >= 600 ? "Indefinite" : v >= 12 ? `${(v / 12).toFixed(1)} years (${v}mo)` : `${v} months`} accent="var(--fg-soft)" />
            </div>
            <IncomeSource label="Passive / rental / other" enabled={passiveEnabled} onToggle={setPassiveEnabled} value={passiveAmt} onChange={setPassiveAmt} max={3000} durationMonths={passiveDur} onDurationChange={setPassiveDur} isMobile={isMobile} />
          </Stack>

          <Stack gap={16}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-mute)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Expenses</div>
            <PrecisionSlider label="Monthly essentials" value={scenarioEssentials} onChange={setScenarioEssentials} min={500} max={6000} step={25} prefix="€" suffix="/mo" accent="var(--fg-mute)" hint="Rent, groceries, utilities, insurance" />
            <PrecisionSlider label="Monthly fun" value={scenarioFun} onChange={setScenarioFun} min={0} max={3000} step={25} prefix="€" suffix="/mo" accent="var(--fg-mute)" hint="Travel, dining, discretionary" />
          </Stack>
        </div>

        {/* Results */}
        <div style={{ background: "var(--surface-2)", borderRadius: 14, padding: isMobile ? 16 : 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Hybrid income</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--good)", fontFamily: "var(--font-mono)" }}>{fmtEur(hybridIncome)}</div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>/month</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Total expenses</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(scenarioExpenses)}</div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>/month</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)" }}>Monthly gap</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: monthlyGap > 0 ? "var(--bad)" : "var(--good)", fontFamily: "var(--font-mono)" }}>
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
              With hybrid income of <strong style={{ color: "var(--good)" }}>{fmtEur(hybridIncome)}/mo</strong>, your portfolio only needs to cover <strong style={{ color: "var(--bad)" }}>{fmtEur(monthlyGap)}/mo</strong>. Your real FIRE target drops from <strong>{fmtEur(fullFireTarget)}</strong> to <strong style={{ color: "var(--accent)" }}>{fmtEur(adjustedFireTarget)}</strong>.
            </div>
          )}
          {monthlyGap === 0 && hybridIncome > 0 && (
            <div style={{ padding: "12px 14px", background: "var(--good-soft)", borderRadius: 10, fontSize: 13, color: "var(--good)", lineHeight: 1.6 }}>
              Your hybrid income fully covers expenses. The portfolio compounds untouched — this is Coast FIRE.
            </div>
          )}
        </div>
      </Card>

      {/* ─── Section 4: Bucket Drawdown Sequencer ─── */}
      <Card>
        <SectionHeader
          eyebrow="Drawdown"
          title="Bucket drawdown sequencer"
          subtitle={drawdownData.series.length > 0 ? `Drawing ${fmtEur(monthlyGap)}/mo initially — Cash → XEON → Bonds → VWCE` : "No drawdown needed — all buckets compound untouched"}
        />

        {drawdownData.series.length > 0 ? (
          <>
            <DrawdownChart
              bucketSeries={drawdownData.series}
              transitions={drawdownData.transitions}
              months={drawdownData.months}
              isMobile={isMobile}
            />

            <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 10, marginTop: 16 }}>
              {[
                { label: "Cash", value: cashRunway, color: BUCKET_META.cash.raw },
                { label: "XEON", value: xeonRunway, color: BUCKET_META.fortress.raw },
                { label: "Bonds", value: bondsRunway, color: BUCKET_META.termShield.raw },
                { label: "Before VWCE", value: totalDefensiveRunway, color: BUCKET_META.growth.raw },
              ].map(b => (
                <div key={b.label} style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: b.color, fontFamily: "var(--font-mono)" }}>
                    {b.value === Infinity ? "∞" : b.value >= 12 ? `${(b.value / 12).toFixed(1)}y` : `${b.value}mo`}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 2 }}>{b.label} runway</div>
                </div>
              ))}
            </div>
          </>
        ) : (
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
          eyebrow="Matrix"
          title="Sensitivity matrix"
          subtitle="Withdrawal rate by annual spend vs. income — green is safe, red is danger"
        />
        <SensitivityGrid
          exitPortfolio={exitPortfolio}
          currentSpend={scenarioExpenses * 12}
          currentIncome={hybridIncome * 12}
          isMobile={isMobile}
        />
        <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "Coast (0%)", bg: "rgba(122,162,255,0.18)", fg: "var(--accent)" },
            { label: "Prosperity (≤3.2%)", bg: "rgba(108,212,154,0.22)", fg: "var(--good)" },
            { label: "Safe (≤4%)", bg: "rgba(108,212,154,0.12)", fg: "var(--good)" },
            { label: "Elevated (≤4.8%)", bg: "rgba(245,184,107,0.18)", fg: "var(--warn)" },
            { label: "Cut zone (>4.8%)", bg: "rgba(239,115,115,0.18)", fg: "var(--bad)" },
          ].map(l => (
            <Row key={l.label} gap={6} align="center">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1px solid ${l.fg}` }} />
              <span style={{ fontSize: 10, color: "var(--fg-soft)" }}>{l.label}</span>
            </Row>
          ))}
        </div>
      </Card>

    </Stack>
  );
}

window.FreedomView = FreedomView;
