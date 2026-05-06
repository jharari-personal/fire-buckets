// ─── TODAY tab — read-only situational awareness ───
// What it answers: "Where am I right now? What needs my attention?"
// All edits live in Plan.

function ProgressRing({ value = 0, size = 132, stroke = 10, color = "var(--accent)", label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, value));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 600ms cubic-bezier(.2,.9,.3,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 2, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  );
}

function GKZoneRibbon({ wr, isMobile }) {
  const min = 0, max = 8;
  const pct = Math.min(1, Math.max(0, (wr - min) / (max - min)));
  const upperPct = (GK_CONFIG.UPPER_GUARDRAIL * 100 - min) / (max - min);
  const iwrPct   = (GK_CONFIG.IWR * 100 - min) / (max - min);
  const lowerPct = (GK_CONFIG.LOWER_GUARDRAIL * 100 - min) / (max - min);
  const zone = getGKZone(wr);

  return (
    <div>
      <Row justify="space-between" align="center" style={{ marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--fg-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Withdrawal rate</div>
          <Row gap={10} align="baseline">
            <span style={{ fontSize: 32, fontWeight: 700, color: zone.color, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
              {wr.toFixed(2)}%
            </span>
            <Pill tone={zone.tone} size="sm">{zone.label}</Pill>
          </Row>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: "var(--fg-soft)", lineHeight: 1.5 }}>
          IWR baseline {(GK_CONFIG.IWR*100).toFixed(1)}%<br />
          Cut threshold {(GK_CONFIG.LOWER_GUARDRAIL*100).toFixed(1)}%
        </div>
      </Row>
      <div style={{ position: "relative", height: 10, borderRadius: 999, background: "var(--surface-3)", overflow: "visible" }}>
        <div style={{ position: "absolute", left: 0, right: `${(1 - upperPct) * 100}%`, top: 0, bottom: 0, background: "rgba(122,162,255,0.18)", borderTopLeftRadius: 999, borderBottomLeftRadius: 999 }} />
        <div style={{ position: "absolute", left: `${upperPct * 100}%`, right: `${(1 - iwrPct) * 100}%`, top: 0, bottom: 0, background: "rgba(108,212,154,0.18)" }} />
        <div style={{ position: "absolute", left: `${iwrPct * 100}%`, right: `${(1 - lowerPct) * 100}%`, top: 0, bottom: 0, background: "rgba(245,184,107,0.18)" }} />
        <div style={{ position: "absolute", left: `${lowerPct * 100}%`, right: 0, top: 0, bottom: 0, background: "rgba(239,115,115,0.18)", borderTopRightRadius: 999, borderBottomRightRadius: 999 }} />
        <div style={{
          position: "absolute", left: `${pct * 100}%`, top: -6,
          width: 22, height: 22, borderRadius: "50%",
          background: zone.color, border: "3px solid var(--bg)",
          transform: "translateX(-50%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          transition: "left 400ms cubic-bezier(.2,.9,.3,1)",
        }} />
      </div>
      <div style={{ position: "relative", marginTop: 10, height: 14 }}>
        {[
          { v: 0, p: 0 }, { v: 3.2, p: upperPct }, { v: 4.0, p: iwrPct }, { v: 4.8, p: lowerPct }, { v: 8, p: 1 },
        ].map((t, i) => (
          <span key={i} style={{ position: "absolute", left: `${t.p * 100}%`, transform: "translateX(-50%)", fontSize: 10, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
            {t.v.toFixed(t.v % 1 === 0 ? 0 : 1)}%
          </span>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-mute)", lineHeight: 1.6, marginTop: 14 }}>
        {wr <= 0
          ? "You're not drawing from the portfolio yet. The withdrawal rate becomes meaningful once you stop earning."
          : zone.id === "prosperity" ? "You can sustainably raise withdrawals 10% next year."
          : zone.id === "safe" ? "Within the safe corridor. No adjustment needed."
          : zone.id === "elevated" ? "Above the 4% baseline but still below the cut threshold. Watch it."
          : zone.id === "cut" ? "Above the 4.8% guardrail. The plan calls for a 10% cut next year."
          : "Drawing comfortably."
        }
      </div>
    </div>
  );
}

function AllocationDonut({ slices, total, size = 140, stroke = 18 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {slices.map((s, i) => {
        const frac = total > 0 ? s.value / total : 0;
        const dash = c * frac;
        const offset = c * acc;
        acc += frac;
        return (
          <circle
            key={i}
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
          />
        );
      })}
    </svg>
  );
}

function TodayView({ state, setState }) {
  const { isMobile } = useViewport();
  const cf = deriveCashflow(state);
  const phase = cf.phase;
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);

  const fortressMonths = cf.totalExpenses > 0 ? (state.bucketXEON||0) / cf.totalExpenses : 0;
  const totalRunwayMonths = cf.totalExpenses > 0 ? ((state.bucketXEON||0) + (state.bucketCash||0)) / cf.totalExpenses : 0;

  // Fisher equation for real return: (1+nom)/(1+inf) − 1
  const realReturn = ((1 + (state.gkNominalReturn || 7.0) / 100) / (1 + (state.gkInflation || 2.0) / 100) - 1) * 100;
  const fireTarget = cf.annualExpenses / GK_CONFIG.IWR;
  const progress = fireTarget > 0 ? Math.min(1, portfolio / fireTarget) : 0;
  const fireGap = Math.max(0, fireTarget - portfolio);
  // Correct FV-with-contributions formula: n = ln((F·r + c)/(P·r + c)) / ln(1+r)
  // The prior formula ln(1 + (F−P)·r/c)/ln(1+r) only holds when P=0.
  const _rMonthly = realReturn / 100 / 12;
  const monthsToFire = cf.surplusMonthly > 0 && fireGap > 0
    ? (_rMonthly === 0
        ? Math.ceil(fireGap / cf.surplusMonthly)
        : Math.log((fireTarget * _rMonthly + cf.surplusMonthly) / (portfolio * _rMonthly + cf.surplusMonthly)) / Math.log(1 + _rMonthly))
    : (fireGap === 0 ? 0 : Infinity);

  const lastWithdrawal = (state.gkHistory && state.gkHistory.length > 0)
    ? state.gkHistory[state.gkHistory.length - 1].finalWithdrawal
    : cf.annualExpenses;
  const wr = portfolio > 0 ? (lastWithdrawal / portfolio) * 100 : 0;

  const slices = [
    { key: "growth",     value: state.bucketVWCE,         color: "var(--b-growth)",   label: "Growth",    sub: "VWCE" },
    { key: "fortress",   value: state.bucketXEON,         color: "var(--b-fortress)", label: "Safety",    sub: "XEON" },
    { key: "termShield", value: state.bucketFixedIncome,  color: "var(--b-fixed)",    label: "Stability", sub: "Bonds" },
    { key: "cash",       value: state.bucketCash,         color: "var(--b-cash)",     label: "Cash",      sub: "EUR" },
  ];

  const rec = monthlyRecommendation(state);

  // FIRE milestones — multiple withdrawal-rate scenarios
  const realReturnMonthly = (realReturn / 100) / 12;
  const monthsToTarget = (target) => {
    if (portfolio >= target) return 0;
    if (cf.surplusMonthly <= 0 && realReturnMonthly <= 0) return Infinity;
    if (cf.surplusMonthly <= 0) {
      const n = Math.log(target / portfolio) / Math.log(1 + realReturnMonthly);
      return n > 600 ? Infinity : Math.ceil(n);
    }
    const r = realReturnMonthly;
    const c = cf.surplusMonthly;
    // Correct closed-form: n = ln((F·r + c)/(P·r + c)) / ln(1+r)
    if (r === 0) return Math.ceil((target - portfolio) / c);
    const n = Math.log((target * r + c) / (portfolio * r + c)) / Math.log(1 + r);
    return Number.isFinite(n) && n > 0 && n <= 600 ? Math.ceil(n) : Infinity;
  };
  const monthsLayoffOnly = (() => {
    if (portfolio >= fireTarget) return 0;
    if (realReturnMonthly <= 0) return Infinity;
    const n = Math.log(fireTarget / portfolio) / Math.log(1 + realReturnMonthly);
    return n > 600 ? Infinity : Math.ceil(n);
  })();

  const milestones = [
    { id: "lean",         label: "Lean FIRE",        wr: GK_CONFIG.IWR, color: "var(--accent)",  sub: "Essentials only, 4% IWR" },
    { id: "aggressive",   label: "Aggressive FIRE",  wr: 0.045,         color: "var(--b-fixed)", sub: "Full spend, 4.5% IWR" },
    { id: "recommended",  label: "Recommended",      wr: 0.035, color: "var(--good)",       sub: "Comfortable margin" },
    { id: "bulletproof",  label: "Bulletproof",      wr: 0.030, color: "var(--b-fortress)", sub: "Sequence-risk proof" },
  ].map(m => {
    const target = m.id === "lean" ? (cf.essentials * 12) / m.wr : cf.annualExpenses / m.wr;
    const months = monthsToTarget(target);
    const reached = portfolio >= target;
    return { ...m, target, months, reached };
  });

  const fmtMonths = (n) => {
    if (n === 0) return "Reached";
    if (!Number.isFinite(n)) return "30+ yrs";
    if (n < 12) return `${n} mo`;
    const y = Math.floor(n / 12);
    const m = n % 12;
    return m === 0 ? `${y} yr${y > 1 ? "s" : ""}` : `${y}y ${m}mo`;
  };
  const fmtETA = (n) => {
    if (!Number.isFinite(n) || n === 0) return null;
    const d = new Date();
    d.setMonth(d.getMonth() + n);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };

  const relevantTriggers = TRIGGERS.filter(t => {
    if (t.event.includes("€500k")) return portfolio >= 450_000 && portfolio < 525_000;
    if (t.event.includes("€625k")) return portfolio >= 575_000 && portfolio < 650_000;
    if (t.event.includes("Layoff")) return state.currentPhase === "employed";
    if (t.event.includes("Sabbatical") || t.event.includes("29GA")) return true;
    return false;
  }).slice(0, 3);

  return (
    <Stack gap={isMobile ? 16 : 20}>
      {/* Hero */}
      <Card padding={isMobile ? 22 : 32} tone="default">
        <Row gap={isMobile ? 20 : 32} wrap={isMobile} align="center">
          <ProgressRing
            value={progress} size={isMobile ? 132 : 160}
            stroke={isMobile ? 12 : 14}
            label={`${Math.round(progress * 100)}%`}
            sub="of FIRE"
            color={progress >= 1 ? "var(--good)" : "var(--accent)"}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
              Portfolio · {phase.label}
            </div>
            <div style={{ fontSize: isMobile ? 36 : 52, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.03em", lineHeight: 1, fontFamily: "var(--font-display)" }}>
              {fmtEur(portfolio)}
            </div>
            <div style={{ fontSize: 14, color: "var(--fg-mute)", marginTop: 12, lineHeight: 1.6 }}>
              {progress >= 1 ? (
                <>You've crossed the FIRE target of <strong style={{ color: "var(--fg)" }}>{fmtEur(fireTarget)}</strong>. {fmtEur(portfolio - fireTarget)} above the line.</>
              ) : (
                <>
                  <strong style={{ color: "var(--fg)" }}>{fmtEur(fireGap)}</strong> to FIRE — about{" "}
                  <strong style={{ color: "var(--fg)" }}>{Number.isFinite(monthsToFire) ? `${(monthsToFire / 12).toFixed(1)} years` : "—"}</strong> at current pace.
                </>
              )}
            </div>
            <Row gap={20} wrap style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>FIRE target</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{fmtEur(fireTarget)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Progress</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{(progress * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Annual cost</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{fmtEur(cf.annualExpenses)}</div>
              </div>
            </Row>
          </div>
        </Row>
      </Card>

      {/* GK zone */}
      <Card padding={isMobile ? 20 : 24}>
        <GKZoneRibbon wr={wr} isMobile={isMobile} />
      </Card>

      {/* FIRE milestones — read-only, multi-scenario */}
      <Card padding={isMobile ? 20 : 24}>
        <SectionHeader
          eyebrow="Milestones"
          title="Four ways to call it done"
          subtitle={cf.surplusMonthly > 0
            ? `Assumes ${fmtEur(cf.surplusMonthly)}/mo contributions and ${realReturn.toFixed(1)}% real return.`
            : `No surplus — projection uses portfolio growth only at ${realReturn.toFixed(1)}% real return.`}
        />
        <Stack gap={10}>
          {milestones.map(m => {
            const pct = Math.min(1, portfolio / m.target);
            const eta = fmtETA(m.months);
            return (
              <div key={m.id} style={{
                padding: "14px 16px",
                background: m.reached ? "var(--good-soft)" : "var(--surface-2)",
                borderRadius: 12,
                border: `1px solid ${m.reached ? "rgba(108,212,154,0.30)" : "var(--hairline)"}`,
              }}>
                <Row justify="space-between" align="center" gap={12} wrap={isMobile} style={{ marginBottom: 10 }}>
                  <Row gap={10} align="center" style={{ minWidth: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <Row gap={8} align="baseline" wrap>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{m.label}</span>
                        <span style={{ fontSize: 11, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>{(m.wr * 100).toFixed(1)}% WR</span>
                      </Row>
                      <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 2 }}>{m.sub}</div>
                    </div>
                  </Row>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.reached ? "var(--good)" : "var(--fg)", fontFamily: "var(--font-mono)" }}>
                      {fmtMonths(m.months)}
                    </div>
                    {eta && !m.reached && (
                      <div style={{ fontSize: 10, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>{eta}</div>
                    )}
                  </div>
                </Row>
                <div style={{ position: "relative", height: 4, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: m.color, transition: "width 600ms ease" }} />
                </div>
                <Row justify="space-between">
                  <span style={{ fontSize: 11, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
                    {fmtEur(portfolio)} of {fmtEur(m.target)}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--fg-mute)", fontFamily: "var(--font-mono)" }}>
                    {(pct * 100).toFixed(0)}%
                  </span>
                </Row>
              </div>
            );
          })}
        </Stack>

        {/* Layoff scenario footnote */}
        <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, borderLeft: "3px solid var(--warn)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>If contributions stopped tomorrow</div>
          <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55 }}>
            {portfolio >= fireTarget ? (
              <>You're already past Aggressive FIRE — no contributions needed.</>
            ) : !Number.isFinite(monthsLayoffOnly) ? (
              <>The {fmtEur(fireTarget)} target isn't reachable within 30 years on portfolio growth alone. Part-time income would close the gap.</>
            ) : (
              <>
                At {realReturn.toFixed(1)}% real return with €0 going in, you'd reach <strong style={{ color: "var(--fg)" }}>{fmtEur(fireTarget)}</strong> in <strong style={{ color: "var(--fg)" }}>{fmtMonths(monthsLayoffOnly)}</strong> ({fmtETA(monthsLayoffOnly)}). Your runway covers <strong style={{ color: "var(--fg)" }}>{Math.round(totalRunwayMonths)} months</strong> — {totalRunwayMonths > monthsLayoffOnly ? "the runway outlasts the gap." : "the gap exceeds runway, so part-time income or a cut to spending would help."}
              </>
            )}
          </div>
        </div>
      </Card>

      {/* This month — recommendation engine */}
      <Card padding={isMobile ? 20 : 24}>
        <SectionHeader
          eyebrow="This month"
          title={rec.headline}
          subtitle={rec.mode === "surplus"
            ? "Direct your surplus where it's needed most. Then update bucket balances in Plan."
            : "Income falls short. Cover what you can from the fun budget; draw the rest from Safety."}
        />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          {/* Cashflow side */}
          <Stack gap={10} style={{ padding: 16, background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--hairline)" }}>
            <Row justify="space-between">
              <span style={{ fontSize: 12, color: "var(--fg-soft)" }}>Income</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--good)" }}>+{fmtEur(cf.incomeMonthly)}</span>
            </Row>
            <Row justify="space-between">
              <span style={{ fontSize: 12, color: "var(--fg-soft)" }}>Essentials</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--fg-mute)" }}>−{fmtEur(cf.essentials)}</span>
            </Row>
            <Row justify="space-between">
              <span style={{ fontSize: 12, color: "var(--fg-soft)" }}>Fun budget</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--fg-mute)" }}>−{fmtEur(cf.fun)}</span>
            </Row>
            <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
              <Row justify="space-between" align="baseline">
                <span style={{ fontSize: 12, color: "var(--fg-mute)", fontWeight: 600 }}>{cf.surplusMonthly >= 0 ? "Surplus" : "Shortfall"}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: cf.surplusMonthly >= 0 ? "var(--good)" : "var(--bad)", fontFamily: "var(--font-mono)" }}>
                  {cf.surplusMonthly >= 0 ? "+" : "−"}{fmtEur(Math.abs(cf.surplusMonthly))}
                </span>
              </Row>
            </div>
          </Stack>

          {/* Action side */}
          <Stack gap={10} style={{ padding: 16, background: rec.mode === "surplus" ? "var(--good-soft)" : "var(--warn-soft)", borderRadius: 12, border: `1px solid ${rec.mode === "surplus" ? "rgba(108,212,154,0.30)" : "rgba(245,184,107,0.30)"}` }}>
            {rec.mode === "surplus" ? (
              <>
                <Row gap={10} align="center">
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: rec.need.meta.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Action</span>
                </Row>
                <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.55 }}>
                  Transfer <strong style={{ fontFamily: "var(--font-mono)", color: "var(--good)" }}>{fmtEur(rec.transfer)}</strong> to <strong>{rec.need.meta.label}</strong> ({rec.need.meta.inst}) — {rec.need.reason === "floor"
                    ? <>{fmtEur(rec.need.gap)} below floor</>
                    : <>{fmtEur(rec.need.gap)} below target allocation</>}.
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55 }}>
                  Spend freely up to <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(rec.funKept)}</strong> on the fun budget
                  {rec.funCut > 0 && <> ({fmtEur(rec.funCut)} held back due to <strong>{rec.zone.label}</strong> zone)</>}.
                </div>
              </>
            ) : (
              <>
                <Row gap={10} align="center">
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--warn)", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Action</span>
                </Row>
                {rec.drawNeeded > 0 ? (
                  <>
                    <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.55 }}>
                      Withdraw <strong style={{ fontFamily: "var(--font-mono)", color: rec.drawSource === "growth" ? "var(--bad)" : "var(--warn)" }}>{fmtEur(rec.drawNeeded)}</strong> from <strong>{rec.drawSourceLabel}</strong> ({rec.drawSourceInst}).
                      {rec.funCut > 0 && <> Trim fun by <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(rec.funCut)}</strong> first.</>}
                    </div>
                    {rec.xeonWarning && (
                      <div style={{ fontSize: 12, color: "var(--warn)", lineHeight: 1.55 }}>
                        ⚠ Safety (XEON) is running low — plan to refill from Stability (Bonds) soon.
                      </div>
                    )}
                    {rec.cgtCost > 0 && (
                      <div style={{ fontSize: 12, color: "var(--bad)", lineHeight: 1.55 }}>
                        Estimated CGT on VWCE draw: ~{fmtEur(rec.cgtCost)} (50% gain assumption, {state.bgCgtRatePct || 10}% rate).
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--fg)", lineHeight: 1.55 }}>
                    Trim fun budget by <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(rec.funCut)}</strong> — you can cover this month without selling.
                  </div>
                )}
                <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55 }}>
                  WR zone: <strong>{rec.zone.label}</strong>.{rec.drawSource !== "growth" && " Do not touch Growth (VWCE)."}
                </div>
              </>
            )}
          </Stack>
        </div>
      </Card>

      {/* Two-up: runway + allocation */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionHeader title="Runway" subtitle="If income stops today" />
          <Stack gap={12}>
            <div>
              <div style={{ fontSize: 38, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", fontFamily: "var(--font-display)", lineHeight: 1 }}>
                {Math.round(totalRunwayMonths)}<span style={{ fontSize: 16, color: "var(--fg-soft)", marginLeft: 6, fontWeight: 500 }}>months</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-mute)", marginTop: 6 }}>
                from Safety + Cash, before touching Growth
              </div>
            </div>
            <Row gap={10}>
              <div style={{ flex: 1, padding: 10, background: "var(--surface-2)", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>Safety only</div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{fortressMonths.toFixed(0)}mo</div>
              </div>
              <div style={{ flex: 1, padding: 10, background: "var(--surface-2)", borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>+ Cash</div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{((state.bucketCash||0) / Math.max(1, cf.totalExpenses)).toFixed(0)}mo</div>
              </div>
            </Row>
          </Stack>
        </Card>

        <Card>
          <SectionHeader title="Allocation" subtitle={`${phase.label} targets`} />
          <Row gap={16} align="center">
            <AllocationDonut slices={slices} total={portfolio} size={104} stroke={14} />
            <Stack gap={8} style={{ flex: 1, minWidth: 0 }}>
              {slices.map(s => {
                const pct = portfolio > 0 ? (s.value / portfolio) * 100 : 0;
                const target = phase.buckets[s.key].target;
                const drift = pct - target;
                return (
                  <Row key={s.key} justify="space-between" gap={8}>
                    <Row gap={8} style={{ minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--fg-mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                    </Row>
                    <Row gap={6}>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--fg)" }}>{pct.toFixed(0)}%</span>
                      {Math.abs(drift) >= 1.5 && (
                        <span style={{ fontSize: 10, color: drift > 0 ? "var(--warn)" : "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
                          {drift > 0 ? "+" : ""}{drift.toFixed(0)}
                        </span>
                      )}
                    </Row>
                  </Row>
                );
              })}
            </Stack>
          </Row>
        </Card>
      </div>

      {/* Decision triggers */}
      {relevantTriggers.length > 0 && (
        <Card>
          <SectionHeader
            eyebrow="On the radar"
            title="Decisions ahead"
            subtitle="Triggers relevant to where you are now."
          />
          <Stack gap={10}>
            {relevantTriggers.map((t, i) => {
              const tones = { immediate: "bad", week: "warn", month: "accent", quarter: "default" };
              const labels = { immediate: "Act now", week: "This week", month: "This month", quarter: "This quarter" };
              return (
                <div key={i} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--hairline)" }}>
                  <Row justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{t.event}</span>
                    <Pill tone={tones[t.urgency]} size="xs">{labels[t.urgency]}</Pill>
                  </Row>
                  <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55 }}>{t.action}</div>
                </div>
              );
            })}
          </Stack>
        </Card>
      )}

      <Disclosure title="What is the GK withdrawal rate?" icon="ⓘ">
        <p>The <strong>Guyton-Klinger guardrails</strong> are a withdrawal rule that adjusts how much you take from the portfolio each year based on how it's performed.</p>
        <p>Your starting baseline is <strong>4%</strong> of the portfolio per year ("IWR"). Each year:</p>
        <ul style={{ paddingLeft: 18, margin: "6px 0" }}>
          <li>If the rate has crept above <strong>4.8%</strong> (markets fell), you cut next year's withdrawal by 10%.</li>
          <li>If it's dropped below <strong>3.2%</strong> (markets rose), you can raise withdrawals by 10%.</li>
          <li>Otherwise you raise withdrawals by the full CPI that year (canonical GK — no cap).</li>
        </ul>
      </Disclosure>
    </Stack>
  );
}

window.TodayView = TodayView;
window.AllocationDonut = AllocationDonut;
window.GKZoneRibbon = GKZoneRibbon;
window.ProgressRing = ProgressRing;
