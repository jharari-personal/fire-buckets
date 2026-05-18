// ─── TODAY tab — read-only situational awareness ───
// What it answers: "Where am I right now? What needs my attention?"
// All edits live in Plan.

// ─── Module-level helpers (shared across components) ─────────────────────
function fmtMonths(n) {
  if (n === 0) return "Reached";
  if (!Number.isFinite(n)) return "30+ yrs";
  if (n < 12) return `${n} mo`;
  const y = Math.floor(n / 12);
  const mo = n % 12;
  return mo === 0 ? `${y} yr${y > 1 ? "s" : ""}` : `${y}y ${mo}mo`;
}

function fmtETA(n) {
  if (!Number.isFinite(n) || n === 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

// ─── ProgressRing ──────────────────────────────────────────────────────────
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

// ─── MilestoneJourney — ribbon slider matching GKZoneRibbon's design ────────
function MilestoneJourney({ portfolio, milestones, isMobile }) {
  const N = milestones.length; // 4
  const next = milestones.find(m => !m.reached);

  // Milestone tick positions: 25%, 50%, 75%, 100%
  const tickPct = i => (i + 1) / N;

  // User marker: section-interpolated so it sits correctly between two ticks
  const passedCount = milestones.filter(m => portfolio >= m.target).length;
  let pct;
  if (passedCount >= N) {
    pct = 1;
  } else {
    const sectionStart = passedCount === 0 ? 0 : tickPct(passedCount - 1);
    const fromTarget   = passedCount === 0 ? 0 : milestones[passedCount - 1].target;
    const toTarget     = milestones[passedCount].target;
    const t = Math.max(0, Math.min(1, (portfolio - fromTarget) / (toTarget - fromTarget)));
    pct = sectionStart + t * (tickPct(passedCount) - sectionStart);
  }

  const markerColor = next ? next.color : "var(--good)";

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
      <div style={{ fontSize: 12, color: "var(--fg-soft)", marginBottom: 14, lineHeight: 1.5 }}>
        {next ? (
          <>Next milestone: <strong style={{ color: "var(--fg)" }}>{next.label}</strong> in{" "}
          <strong style={{ color: next.color, fontFamily: "var(--font-mono)" }}>{fmtMonths(next.months)}</strong></>
        ) : (
          <>All milestones reached. You're past Bulletproof FIRE.</>
        )}
      </div>

      {/* Track — same structure as GKZoneRibbon */}
      <div style={{ position: "relative", height: 10, borderRadius: 999, background: "var(--surface-3)", overflow: "visible" }}>
        {/* One coloured band per milestone section */}
        {milestones.map((m, i) => {
          const left  = i === 0 ? 0 : tickPct(i - 1) * 100;
          const right = (1 - tickPct(i)) * 100;
          return (
            <div key={m.id} style={{
              position: "absolute",
              left: `${left}%`, right: `${right}%`,
              top: 0, bottom: 0,
              background: m.color, opacity: 0.18,
              borderTopLeftRadius:     i === 0     ? 999 : 0,
              borderBottomLeftRadius:  i === 0     ? 999 : 0,
              borderTopRightRadius:    i === N - 1 ? 999 : 0,
              borderBottomRightRadius: i === N - 1 ? 999 : 0,
            }} />
          );
        })}
        {/* User marker */}
        <div style={{
          position: "absolute",
          left: `${pct * 100}%`, top: -7,
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--fg)",
          border: `4px solid ${markerColor}`,
          transform: "translateX(-50%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 0 2px var(--bg)",
          transition: "left 400ms cubic-bezier(.2,.9,.3,1), border-color 400ms ease",
        }} />
      </div>

      {/* Labels — absolutely positioned under each tick */}
      <div style={{ position: "relative", marginTop: 10, height: 14 }}>
        {milestones.map((m, i) => {
          const isLast = i === N - 1;
          return (
            <span key={m.id} style={{
              position: "absolute",
              left: `${tickPct(i) * 100}%`,
              transform: isLast ? "translateX(-100%)" : "translateX(-50%)",
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: portfolio >= m.target ? m.color : "var(--fg-soft)",
              fontWeight: portfolio >= m.target ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
              {m.label.replace(" FIRE", "").replace("Recommended", "Rec.").replace("Aggressive", "Agg.")}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── PortfolioCapacityCard — what the portfolio can cover right now ────────
function PortfolioCapacityCard({ safeMonthly, essentials, fullLife, isMobile }) {
  const essCoverage = essentials > 0 ? Math.min(1, safeMonthly / essentials) : 0;
  const lifeCoverage = fullLife > 0 ? Math.min(1, safeMonthly / fullLife) : 0;
  const essGap = Math.max(0, essentials - safeMonthly);
  const lifeGap = Math.max(0, fullLife - safeMonthly);

  const CoverageBar = ({ label, coverage, gap }) => {
    const pct = coverage * 100;
    const tone = pct >= 100 ? "good" : pct >= 70 ? "warn" : "bad";
    const toneColor = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : "var(--bad)";
    return (
      <div>
        <Row justify="space-between" align="baseline" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{label}</span>
          <Row gap={10} align="baseline">
            <span style={{ fontSize: 13, fontWeight: 700, color: toneColor, fontFamily: "var(--font-mono)" }}>{pct.toFixed(0)}%</span>
            {gap > 0 && (
              <span style={{ fontSize: 11, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
                {fmtEur(gap)}/mo gap
              </span>
            )}
          </Row>
        </Row>
        <div style={{ position: "relative", height: 6, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${Math.min(100, pct)}%`, background: toneColor,
            transition: "width 500ms ease",
          }} />
        </div>
      </div>
    );
  };

  return (
    <Card padding={isMobile ? 20 : 24}>
      <SectionHeader title="Portfolio capacity today" subtitle="What the current balance can sustainably cover, regardless of your spending plan." />
      <div style={{
        padding: "16px 18px", background: "var(--surface-2)",
        borderRadius: 12, borderLeft: "3px solid var(--accent)", marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
          Safe monthly income
        </div>
        <Row gap={10} align="baseline" style={{ marginTop: 4 }}>
          <span style={{ fontSize: isMobile ? 28 : 34, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>
            {fmtEur(safeMonthly)}<span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-soft)" }}>/mo</span>
          </span>
        </Row>
        <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 6 }}>
          at 4% initial WR · {fmtEur(safeMonthly * 12)}/yr
        </div>
      </div>
      <Stack gap={14}>
        <CoverageBar label="Essentials" coverage={essCoverage} gap={essGap} />
        <CoverageBar label="Full lifestyle" coverage={lifeCoverage} gap={lifeGap} />
      </Stack>
    </Card>
  );
}

// ─── RunwayStackedBar ──────────────────────────────────────────────────────
function RunwayStackedBar({ monthlyExpenses, cash, fortress, fixed, growth, isMobile }) {
  if (monthlyExpenses <= 0) return null;
  const cashMo   = cash    / monthlyExpenses;
  const fortMo   = fortress / monthlyExpenses;
  const fixedMo  = fixed   / monthlyExpenses;
  const growthMo = growth  / monthlyExpenses;

  const safeMo = cashMo + fortMo + fixedMo;
  const chartCap = Math.max(safeMo * 1.4, 36);
  const cashW   = Math.min(1, cashMo   / chartCap);
  const fortW   = Math.min(1, fortMo   / chartCap);
  const fixedW  = Math.min(1, fixedMo  / chartCap);
  const growthVisible = Math.max(0, 1 - cashW - fortW - fixedW);

  const Seg = ({ width, color, label, mo }) => (
    <div style={{
      flex: width, height: "100%", background: color,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      borderRight: "1px solid var(--bg)", minWidth: 0, overflow: "hidden",
    }} title={`${label} ${mo.toFixed(1)}mo`}>
      {width > 0.10 && (
        <>
          <span style={{ fontSize: 10, color: "var(--bg)", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: 11, color: "var(--bg)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{mo.toFixed(0)}mo</span>
        </>
      )}
    </div>
  );

  return (
    <div>
      <Row gap={0} style={{
        height: 44, borderRadius: 8, overflow: "hidden",
        border: "1px solid var(--hairline)", background: "var(--surface-3)",
      }}>
        <Seg width={cashW}   color="var(--b-cash)"     label="Cash"      mo={cashMo} />
        <Seg width={fortW}   color="var(--b-fortress)" label="Safety"    mo={fortMo} />
        <Seg width={fixedW}  color="var(--b-fixed)"    label="Stability" mo={fixedMo} />
        <div style={{
          flex: growthVisible, height: "100%",
          background: "repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 6px, var(--surface-1) 6px, var(--surface-1) 12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {growthVisible > 0.15 && (
            <span style={{ fontSize: 11, color: "var(--fg-mute)", fontWeight: 600 }}>Growth →</span>
          )}
        </div>
      </Row>
      <Row justify="space-between" style={{ marginTop: 6, fontSize: 10, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
        <span>0</span>
        <span>{Math.round(chartCap / 4)}mo</span>
        <span>{Math.round(chartCap / 2)}mo</span>
        <span>{Math.round(chartCap * 3 / 4)}mo</span>
        <span>{Math.round(chartCap)}mo</span>
      </Row>
    </div>
  );
}

// ─── MilestoneRow — compact single-line milestone ─────────────────────────
function MilestoneRow({ m, portfolio }) {
  const pct = Math.min(1, portfolio / m.target);
  return (
    <Row justify="space-between" align="center" gap={12} style={{
      padding: "10px 14px",
      background: m.reached ? "var(--good-soft)" : "var(--surface-2)",
      borderRadius: 10,
      border: `1px solid ${m.reached ? "rgba(108,212,154,0.25)" : "var(--hairline)"}`,
    }}>
      <Row gap={10} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{m.label}</span>
        <span style={{ fontSize: 10, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>{(m.wr * 100).toFixed(1)}%</span>
        {m.caution && (
          <span title={m.caution} style={{ fontSize: 11, color: "var(--warn)", cursor: "help" }}>⚠</span>
        )}
      </Row>
      <div style={{ width: 80, height: 4, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", background: m.color, transition: "width 500ms ease" }} />
      </div>
      <div style={{ minWidth: 70, textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: m.reached ? "var(--good)" : "var(--fg)", fontFamily: "var(--font-mono)" }}>
          {fmtMonths(m.months)}
        </div>
      </div>
    </Row>
  );
}

// ─── GKZoneRibbon ─────────────────────────────────────────────────────────
function GKZoneRibbon({ wr, isMobile, currentAnnual, proposedAnnual }) {
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
          position: "absolute", left: `${pct * 100}%`, top: -7,
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--fg)",
          border: `4px solid ${zone.color}`,
          transform: "translateX(-50%)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.5), 0 0 0 2px var(--bg)",
          transition: "left 400ms cubic-bezier(.2,.9,.3,1), border-color 400ms ease",
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
          : zone.id === "cut"
            ? <>Above the 4.8% guardrail. Next year cut <strong style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(currentAnnual)}</strong> → <strong style={{ color: "var(--bad)", fontFamily: "var(--font-mono)" }}>{fmtEur(proposedAnnual)}</strong> (−10%).</>
            : zone.id === "prosperity"
              ? <>Below the 3.2% guardrail. You can raise <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(currentAnnual)}</strong> → <strong style={{ color: "var(--good)", fontFamily: "var(--font-mono)" }}>{fmtEur(proposedAnnual)}</strong> (+10%).</>
              : zone.id === "elevated"
                ? <>Above the 4% baseline. Inflation adjustment next year: <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(currentAnnual)}</strong> → <strong style={{ color: "var(--warn)", fontFamily: "var(--font-mono)" }}>{fmtEur(proposedAnnual)}</strong>. Watch it.</>
                : "Within the safe corridor. No adjustment needed."
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

// ─── TriggerRow ───────────────────────────────────────────────────────────
function TriggerRow({ t }) {
  const tones  = { immediate: "bad", week: "warn", month: "accent", quarter: "default" };
  const labels = { immediate: "Act now", week: "This week", month: "This month", quarter: "This quarter" };
  return (
    <div style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--hairline)" }}>
      <Row justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{t.event}</span>
        <Pill tone={tones[t.urgency]} size="xs">{labels[t.urgency]}</Pill>
      </Row>
      <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55 }}>{t.action}</div>
    </div>
  );
}

// ─── This Month card ──────────────────────────────────────────────────────
function ThisMonthCard({ outlook, state, isMobile, monthsOf }) {
  const cf = outlook.cf;
  const p = outlook.primary;
  const reason = p.reason || {};

  const modePill = outlook.mode === "accumulating"
    ? { tone: "good", label: "Accumulating" }
    : outlook.mode === "lean_drawdown"
      ? { tone: "warn", label: "Drawdown" }
      : { tone: "bad",  label: "Drawdown" };

  const chipBase = {
    padding: "6px 10px", borderRadius: 999, fontSize: 12,
    fontFamily: "var(--font-mono)", fontWeight: 600,
    border: "1px solid var(--hairline)", background: "var(--surface-2)",
    whiteSpace: "nowrap",
  };
  const surplusPositive = cf.surplusMonthly >= 0;
  const surplusChip = {
    ...chipBase,
    color: surplusPositive ? "var(--good)" : "var(--bad)",
    borderColor: surplusPositive ? "rgba(108,212,154,0.35)" : "rgba(239,115,115,0.35)",
    background: surplusPositive ? "var(--good-soft)" : "var(--warn-soft)",
    fontWeight: 700,
  };

  const accentColor = p.meta?.color || "var(--warn)";

  const floorRationale = (reason.type === "floor" && p.bucketKey === "fortress")
    ? `Floor ${fmtEur(reason.floorEur)} = ${reason.floorMonths} months of expenses. You're at ${fmtEur(cf.totalExpenses > 0 ? Math.round(outlook.floorContext.current) : 0)} — ${fmtEur(reason.gap)} short. Floor takes priority over the ${reason.targetPct}% target.`
    : (reason.type === "floor"
        ? `Floor ${fmtEur(reason.floorEur)} = ${reason.floorMonths} months of expenses. ${fmtEur(reason.gap)} short. Floor takes priority over the ${reason.targetPct}% target.`
        : null);

  const targetRationale = reason.type === "target"
    ? (reason.gap > 0
        ? `Underweight: ${reason.gap > 0 ? fmtEur(reason.gap) : ""} below the ${reason.targetPct}% target (range ${reason.rangeLowerPct}–${reason.rangeUpperPct}%).`
        : `All buckets in range. Direct surplus to ${p.meta.label} to keep momentum.`)
    : null;

  const cascadeRationale = reason.type === "cascade"
    ? (reason.source === "cash" ? `Cash covers it — no sell, no tax.`
        : reason.source === "fortress" ? `Cash exhausted. Safety (XEON) is next per draw order — stable value, no CGT.`
        : reason.source === "termShield" ? `Cash and Safety drained. Drawing from Stability (Bonds).`
        : `Last resort — selling Growth (VWCE) means realizing gains and pausing compounding.`)
    : null;

  const funCoversRationale = reason.type === "fun_covers"
    ? `Cut fun from ${fmtEur(reason.funBefore)} to ${fmtEur(reason.funAfter)}. Cover the shortfall from this month's discretionary budget — no portfolio sale required.`
    : null;

  const afterLine = (() => {
    if (outlook.mode === "accumulating" && p.amount > 0 && p.meta) {
      const after = reason.afterBalance ?? (reason.afterBalance);
      const afterMo = reason.afterMonths || 0;
      if (p.bucketKey === "fortress" && afterMo > 0) {
        return `After: ${p.meta.label} at ${fmtEur(after)} → ${afterMo.toFixed(1)} months of runway covered.`;
      }
      return `After: ${p.meta.label} balance ${fmtEur(after)}.`;
    }
    if (outlook.mode === "shortfall" && p.amount > 0 && p.meta && reason.source !== "growth") {
      const after = Math.max(0, reason.afterBalance);
      const afterMo = monthsOf(after);
      return `After: ${p.meta.label} balance ${fmtEur(after)} → ${afterMo.toFixed(1)} months remaining.`;
    }
    return null;
  })();

  return (
    <Card padding={isMobile ? 20 : 24}>
      <Row justify="space-between" align="flex-start" gap={12} style={{ marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--fg-soft)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
            This month
          </div>
          <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
            {outlook.headline}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-mute)", marginTop: 6, lineHeight: 1.5 }}>
            {outlook.subtitle}
          </div>
        </div>
        <Pill tone={modePill.tone} size="sm">{modePill.label}</Pill>
      </Row>

      <Row gap={8} wrap style={{ marginBottom: 16 }}>
        <span style={{ ...chipBase, color: "var(--good)" }}>Income +{fmtEur(cf.incomeMonthly)}</span>
        <span style={chipBase}>Essentials −{fmtEur(cf.essentials)}</span>
        <span style={chipBase}>Fun −{fmtEur(cf.fun)}</span>
        <span style={surplusChip}>
          {surplusPositive ? "Surplus +" : "Shortfall −"}{fmtEur(Math.abs(cf.surplusMonthly))}
        </span>
      </Row>

      <div style={{
        borderLeft: `4px solid ${accentColor}`,
        background: "var(--surface-2)",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: outlook.floorContext || outlook.secondary.length > 0 ? 12 : 0,
      }}>
        <Row gap={8} align="baseline" wrap>
          <span style={{ fontSize: 11, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            Action
          </span>
        </Row>
        <div style={{ marginTop: 6, fontSize: isMobile ? 17 : 19, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em", lineHeight: 1.35 }}>
          <span style={{ color: accentColor === "var(--warn)" || outlook.mode === "shortfall" ? "var(--warn)" : "var(--good)" }}>
            {p.verb}{" "}
          </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(p.amount)}</span>
          {p.meta && (
            <>
              {" "}
              <span style={{ color: "var(--fg-mute)", fontWeight: 500 }}>
                {p.verb === "Invest" ? "into" : "from"}
              </span>{" "}
              <span>{p.meta.label}</span>
              <span style={{ color: "var(--fg-soft)", fontWeight: 500, fontSize: isMobile ? 14 : 16 }}> ({p.meta.inst})</span>
            </>
          )}
        </div>
        {(floorRationale || targetRationale || cascadeRationale || funCoversRationale) && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.6 }}>
            <span style={{ color: "var(--fg-soft)", fontWeight: 600 }}>Why: </span>
            {floorRationale || targetRationale || cascadeRationale || funCoversRationale}
          </div>
        )}
        {afterLine && (
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.6 }}>
            <span style={{ color: "var(--fg-soft)", fontWeight: 600 }}>After: </span>
            {afterLine.replace(/^After:\s*/, "")}
          </div>
        )}
      </div>

      {outlook.floorContext && (() => {
        const fc = outlook.floorContext;
        const pct = fc.floor > 0 ? Math.min(1, fc.current / fc.floor) : 0;
        return (
          <div style={{ marginBottom: outlook.secondary.length > 0 ? 12 : 0, padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--hairline)" }}>
            <Row justify="space-between" align="baseline" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {fc.meta.label} floor
              </span>
              <span style={{ fontSize: 12, color: "var(--fg-mute)", fontFamily: "var(--font-mono)" }}>
                {(pct * 100).toFixed(0)}%
              </span>
            </Row>
            <div style={{ position: "relative", height: 6, background: "var(--surface-3)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct * 100}%`, background: fc.meta.raw, transition: "width 500ms ease" }} />
            </div>
            <Row justify="space-between" style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
                {fmtEur(fc.current)} / {fmtEur(fc.floor)}
              </span>
              <span style={{ fontSize: 11, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>
                {fc.currentMonths.toFixed(1)}mo / {fc.months}mo
              </span>
            </Row>
          </div>
        );
      })()}

      {outlook.secondary.length > 0 && (
        <Stack gap={8}>
          {outlook.secondary.map((s, i) => {
            if (s.type === "rebalance_out") {
              return (
                <div key={i} style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55, borderLeft: "3px solid var(--warn)" }}>
                  <Row gap={8} align="baseline" wrap>
                    <span style={{ color: "var(--warn)", fontWeight: 600 }}>↻ Rebalance:</span>
                    <span>
                      <strong style={{ color: "var(--fg)" }}>{s.fromMeta.label}</strong> ({s.fromMeta.inst}) is{" "}
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{fmtEur(s.excessEur)}</strong> above its {s.rangeUpperPct}% range cap. Consider trimming into <strong style={{ color: "var(--fg)" }}>{s.toMeta.label}</strong> at your next rebalance.
                    </span>
                  </Row>
                </div>
              );
            }
            if (s.type === "fun_trim") {
              return (
                <div key={i} style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55, borderLeft: "3px solid var(--fg-soft)" }}>
                  <span style={{ color: "var(--fg-soft)", fontWeight: 600 }}>● Trim fun first: </span>
                  Reduce fun by <strong style={{ fontFamily: "var(--font-mono)", color: "var(--fg)" }}>{fmtEur(s.funCutEur)}</strong> ({fmtEur(s.funBefore)} → {fmtEur(s.funAfter)}) to shrink the draw.
                </div>
              );
            }
            if (s.type === "xeon_low") {
              return (
                <div key={i} style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--warn)", lineHeight: 1.55, borderLeft: "3px solid var(--warn)" }}>
                  ⚠ <strong>Safety (XEON) is running low</strong> — about {s.monthsLeft.toFixed(1)} months left at this draw rate. Plan to refill from Stability (Bonds) soon.
                </div>
              );
            }
            if (s.type === "cgt") {
              return (
                <div key={i} style={{ padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--bad)", lineHeight: 1.55, borderLeft: "3px solid var(--bad)" }}>
                  € <strong>CGT estimate:</strong> ~{fmtEur(s.costEur)} on a VWCE sale (50% gain assumption, {s.ratePct}% rate).
                </div>
              );
            }
            return null;
          })}
        </Stack>
      )}
    </Card>
  );
}

function TodayView({ state, setState }) {
  const { isMobile } = useViewport();
  const cf = deriveCashflow(state);
  const phase = cf.phase;
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);

  // Defense runway: Cash + Safety + Stability, before touching Growth
  const safeRunwayMonths = cf.totalExpenses > 0
    ? ((state.bucketXEON||0) + (state.bucketCash||0) + (state.bucketFixedIncome||0)) / cf.totalExpenses
    : 0;

  // Fisher equation for real return
  const realReturn = ((1 + (state.gkNominalReturn || 7.0) / 100) / (1 + (state.gkInflation || 2.0) / 100) - 1) * 100;

  // FIRE targets
  const fireTarget      = cf.annualExpenses / GK_CONFIG.IWR;   // Aggressive 4% — used for hero sentence
  const bulletproofTarget = cf.annualExpenses / 0.03;           // Bulletproof 3% — used for ring max

  // progress for hero sentence logic; ringProgress for ring arc
  const progress      = fireTarget > 0 ? Math.min(1, portfolio / fireTarget) : 0;
  const ringProgress  = bulletproofTarget > 0 ? Math.min(1, portfolio / bulletproofTarget) : 0;
  const fireGap       = Math.max(0, fireTarget - portfolio);

  const realReturnMonthly = Math.pow(1 + realReturn / 100, 1 / 12) - 1;
  const monthsToTarget = (target) => {
    if (portfolio >= target) return 0;
    if (cf.surplusMonthly <= 0 && realReturnMonthly <= 0) return Infinity;
    if (cf.surplusMonthly <= 0) {
      const n = Math.log(target / portfolio) / Math.log(1 + realReturnMonthly);
      return n > 600 ? Infinity : Math.ceil(n);
    }
    const r = realReturnMonthly;
    const c = cf.surplusMonthly;
    if (r === 0) return Math.ceil((target - portfolio) / c);
    const numerator   = target    * r + c;
    const denominator = portfolio * r + c;
    if (denominator <= 0 || numerator <= 0) return Infinity;
    const n = Math.log(numerator / denominator) / Math.log(1 + r);
    return Number.isFinite(n) && n > 0 && n <= 600 ? Math.ceil(n) : Infinity;
  };

  const _rMonthly = realReturnMonthly;
  const monthsToFire = cf.surplusMonthly > 0 && fireGap > 0
    ? (_rMonthly === 0
        ? Math.ceil(fireGap / cf.surplusMonthly)
        : Math.log((fireTarget * _rMonthly + cf.surplusMonthly) / (portfolio * _rMonthly + cf.surplusMonthly)) / Math.log(1 + _rMonthly))
    : (fireGap === 0 ? 0 : Infinity);

  const monthsLayoffOnly = (() => {
    if (portfolio >= fireTarget) return 0;
    if (realReturnMonthly <= 0) return Infinity;
    const n = Math.log(fireTarget / portfolio) / Math.log(1 + realReturnMonthly);
    return n > 600 ? Infinity : Math.ceil(n);
  })();

  const lastWithdrawal = effectiveLastWithdrawal(state);
  const wr = portfolio > 0 ? (lastWithdrawal / portfolio) * 100 : 0;
  const wrZone = getGKZone(wr);
  const proposedAnnual = lastWithdrawal > 0
    ? (wrZone.id === "cut" ? lastWithdrawal * 0.9
       : wrZone.id === "prosperity" ? lastWithdrawal * 1.1
       : lastWithdrawal * (1 + Math.min((state.gkInflation || 2.0) / 100, 0.06)))
    : 0;

  const safeMonthly = portfolio * GK_CONFIG.IWR / 12;

  const slices = [
    { key: "growth",     value: state.bucketVWCE,         color: "var(--b-growth)",   label: "Growth",    sub: "VWCE" },
    { key: "fortress",   value: state.bucketXEON,         color: "var(--b-fortress)", label: "Safety",    sub: "XEON" },
    { key: "termShield", value: state.bucketFixedIncome,  color: "var(--b-fixed)",    label: "Stability", sub: "Bonds" },
    { key: "cash",       value: state.bucketCash,         color: "var(--b-cash)",     label: "Cash",      sub: "EUR" },
  ];

  const outlook = monthlyOutlook(state);
  const monthsOf = (eur) => cf.totalExpenses > 0 ? eur / cf.totalExpenses : 0;

  const milestones = [
    { id: "lean",        label: "Lean FIRE",       wr: 0.045,         color: "var(--accent)",  sub: "Essentials only, 4.5% IWR", caution: "No discretionary buffer — a GK 10% cut would drop below essential spending." },
    { id: "aggressive",  label: "Aggressive FIRE", wr: GK_CONFIG.IWR, color: "var(--b-fixed)", sub: "Full spend, 4% IWR" },
    { id: "recommended", label: "Recommended",     wr: 0.035,         color: "var(--good)",    sub: "Comfortable margin" },
    { id: "bulletproof", label: "Bulletproof",     wr: 0.030,         color: "var(--b-fortress)", sub: "Sequence-risk proof" },
  ].map(m => {
    const target = m.id === "lean" ? (cf.essentials * 12) / m.wr : cf.annualExpenses / m.wr;
    const months = monthsToTarget(target);
    const reached = portfolio >= target;
    return { ...m, target, months, reached };
  });

  const relevantTriggers = evaluateTriggers(state);

  return (
    <Stack gap={isMobile ? 16 : 16}>

      {/* ── Hero ── */}
      <Card padding={isMobile ? 22 : 32} tone="default">
        <Row gap={isMobile ? 20 : 32} wrap={isMobile} align="center">
          <ProgressRing
            value={ringProgress} size={isMobile ? 132 : 160}
            stroke={isMobile ? 12 : 14}
            label={`${Math.round(ringProgress * 100)}%`}
            sub="of FIRE"
            color={ringProgress >= 1 ? "var(--good)" : "var(--accent)"}
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
              ) : Number.isFinite(monthsToFire) ? (
                <>
                  <strong style={{ color: "var(--fg)" }}>{fmtEur(fireGap)}</strong> to FIRE — about{" "}
                  <strong style={{ color: "var(--fg)" }}>{(monthsToFire / 12).toFixed(1)} years</strong> at current pace.
                </>
              ) : (
                <>
                  <strong style={{ color: "var(--fg)" }}>{fmtEur(fireGap)}</strong> to FIRE.
                  No surplus right now — portfolio growth alone would close the gap in{" "}
                  <strong style={{ color: "var(--fg)" }}>{fmtMonths(monthsLayoffOnly)}</strong>.
                </>
              )}
            </div>
            <MilestoneJourney portfolio={portfolio} milestones={milestones} isMobile={isMobile} />
          </div>
        </Row>
      </Card>

      {/* ── WR card — directly under hero in drawdown, accent tone ── */}
      {outlook.mode !== "accumulating" && (
        <Card padding={isMobile ? 20 : 24} tone="accent">
          <GKZoneRibbon wr={wr} isMobile={isMobile} currentAnnual={lastWithdrawal} proposedAnnual={proposedAnnual} />
        </Card>
      )}

      {/* ── Portfolio capacity ── */}
      <PortfolioCapacityCard
        safeMonthly={safeMonthly}
        essentials={cf.essentials}
        fullLife={cf.essentials + cf.fun}
        isMobile={isMobile}
      />

      {/* ── This month ── */}
      <ThisMonthCard outlook={outlook} state={state} isMobile={isMobile} monthsOf={monthsOf} />

      {/* ── FIRE milestones — compact rows ── */}
      <Card padding={isMobile ? 20 : 24}>
        <SectionHeader
          eyebrow="Milestones"
          title="Four ways to call it done"
          subtitle={cf.surplusMonthly > 0
            ? `Assumes ${fmtEur(cf.surplusMonthly)}/mo contributions and ${realReturn.toFixed(1)}% real return.`
            : `No surplus — projection uses portfolio growth only at ${realReturn.toFixed(1)}% real return.`}
        />
        <Stack gap={8}>
          {milestones.map(m => <MilestoneRow key={m.id} m={m} portfolio={portfolio} />)}
        </Stack>
        <div style={{ marginTop: 10 }}>
          <Disclosure title="What if contributions stopped tomorrow?">
            <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.55, padding: "10px 0 2px" }}>
              {portfolio >= fireTarget ? (
                <>You're already past Aggressive FIRE — no contributions needed.</>
              ) : !Number.isFinite(monthsLayoffOnly) ? (
                <>The {fmtEur(fireTarget)} target isn't reachable within 30 years on portfolio growth alone. Part-time income would close the gap.</>
              ) : (
                <>
                  At {realReturn.toFixed(1)}% real return with €0 going in, you'd reach <strong style={{ color: "var(--fg)" }}>{fmtEur(fireTarget)}</strong> in <strong style={{ color: "var(--fg)" }}>{fmtMonths(monthsLayoffOnly)}</strong> ({fmtETA(monthsLayoffOnly)}). Your runway covers <strong style={{ color: "var(--fg)" }}>{Math.round(safeRunwayMonths)} months</strong> — {safeRunwayMonths > monthsLayoffOnly ? "the runway outlasts the gap." : "the gap exceeds runway, so part-time income or a cut to spending would help."}
                </>
              )}
            </div>
          </Disclosure>
        </div>
      </Card>

      {/* ── Two-up: runway + allocation ── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <SectionHeader title="Runway" subtitle="If income stops today, here's the burn order." />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 38, fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em", fontFamily: "var(--font-display)", lineHeight: 1 }}>
              {Math.round(safeRunwayMonths)}<span style={{ fontSize: 16, color: "var(--fg-soft)", marginLeft: 6, fontWeight: 500 }}>months</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-mute)", marginTop: 6 }}>
              from defense buckets, before touching Growth
            </div>
          </div>
          <RunwayStackedBar
            monthlyExpenses={cf.totalExpenses}
            cash={state.bucketCash || 0}
            fortress={state.bucketXEON || 0}
            fixed={state.bucketFixedIncome || 0}
            growth={state.bucketVWCE || 0}
            isMobile={isMobile}
          />
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
                        <Pill tone={drift > 0 ? "warn" : "default"} size="xs">
                          {drift > 0 ? "+" : "−"}{Math.abs(drift).toFixed(1)} pp
                        </Pill>
                      )}
                    </Row>
                  </Row>
                );
              })}
            </Stack>
          </Row>
          {(() => {
            const drifts = slices.map(s => {
              const pct = portfolio > 0 ? (s.value / portfolio) * 100 : 0;
              const target = phase.buckets[s.key].target;
              return { key: s.key, label: s.label, drift: pct - target, eur: Math.abs(((pct - target) / 100) * portfolio) };
            });
            const worst = drifts.filter(d => Math.abs(d.drift) >= 3).sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))[0];
            if (!worst) return null;
            return (
              <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5, borderLeft: "2px solid var(--warn)" }}>
                <span style={{ color: "var(--warn)", fontWeight: 600 }}>↻ Rebalance:</span>{" "}
                <strong style={{ color: "var(--fg)" }}>{worst.label}</strong> is {Math.abs(worst.drift).toFixed(1)} pp{" "}
                {worst.drift > 0 ? "above" : "below"} target ({fmtEur(worst.eur)}). Adjust at your next monthly review.
              </div>
            );
          })()}
        </Card>
      </div>

      {/* ── Decisions ahead — top 2 inline, rest in disclosure ── */}
      {relevantTriggers.length > 0 && (() => {
        const order = { immediate: 0, week: 1, month: 2, quarter: 3 };
        const sorted = [...relevantTriggers].sort((a, b) => (order[a.urgency] ?? 9) - (order[b.urgency] ?? 9));
        const shown  = sorted.slice(0, 2);
        const hidden = sorted.slice(2);
        return (
          <Card>
            <SectionHeader title="Decisions ahead" subtitle="Triggers relevant to where you are now." />
            <Stack gap={10}>
              {shown.map(t => <TriggerRow key={t.key} t={t} />)}
            </Stack>
            {hidden.length > 0 && (
              <Disclosure title={`Show ${hidden.length} more`} defaultOpen={false}>
                <Stack gap={10} style={{ marginTop: 8 }}>
                  {hidden.map(t => <TriggerRow key={t.key} t={t} />)}
                </Stack>
              </Disclosure>
            )}
          </Card>
        );
      })()}

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
