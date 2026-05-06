// ─── PLAN tab — design the strategy ───
// Phase, allocation drift, monthly cashflow inputs, bucket balances.

function PhaseBadge({ id, label, sub, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 0, textAlign: "left",
        padding: "12px 14px",
        background: active ? "var(--surface-3)" : "transparent",
        border: `1px solid ${active ? "var(--hairline-strong)" : "var(--hairline)"}`,
        borderRadius: 12, cursor: "pointer",
        transition: "all 160ms ease",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--fg)" : "var(--fg-mute)" }}>{label}</div>
      <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 3 }}>{sub}</div>
    </button>
  );
}

function DriftBar({ pct, target, range, color }) {
  return (
    <div style={{ position: "relative", height: 8, background: "var(--surface-3)", borderRadius: 999, overflow: "visible" }}>
      <div style={{ position: "absolute", left: `${range[0]}%`, right: `${100 - range[1]}%`, top: 0, bottom: 0, background: `${color}33`, borderRadius: 999 }} />
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, pct)}%`, background: color, borderRadius: 999, transition: "width 400ms ease" }} />
      <div style={{ position: "absolute", left: `${target}%`, top: -4, bottom: -4, width: 2, background: "var(--fg)", opacity: 0.6 }} />
    </div>
  );
}

function PlanView({ state, setState }) {
  const { isMobile } = useViewport();
  const cf = deriveCashflow(state);
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  const phase = cf.phase;
  const fireTarget = cf.annualExpenses / GK_CONFIG.IWR;

  const updateState = (k, v) => setState(s => ({ ...s, [k]: v }));

  // When switching to laid_off, zero the primary salary so cashflow reflects reality.
  const switchPhase = (id) => {
    setState(s => {
      const next = { ...s, currentPhase: id };
      if (id === "laid_off") next.monthlySalaryEUR = 0;
      return next;
    });
  };

  const buckets = [
    { key: "bucketVWCE",        meta: BUCKET_META.growth,     phaseKey: "growth" },
    { key: "bucketXEON",        meta: BUCKET_META.fortress,   phaseKey: "fortress" },
    { key: "bucketFixedIncome", meta: BUCKET_META.termShield, phaseKey: "termShield" },
    { key: "bucketCash",        meta: BUCKET_META.cash,       phaseKey: "cash" },
  ];

  const showPrimarySalary = state.currentPhase !== "laid_off";

  return (
    <Stack gap={isMobile ? 16 : 20}>
      {/* Phase */}
      <Card>
        <SectionHeader
          eyebrow="Phase"
          title="Where in your journey are you?"
          subtitle="The phase sets target allocation and the cashflow assumptions. Switch when life changes."
        />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
          {Object.values(PHASES).map(p => (
            <PhaseBadge
              key={p.id} id={p.id}
              label={p.label} sub={p.subtitle}
              active={state.currentPhase === p.id}
              onClick={() => switchPhase(p.id)}
            />
          ))}
        </div>
      </Card>

      {/* Bucket balances — moved here from Today */}
      <Card>
        <SectionHeader
          eyebrow="Update"
          title="Bucket balances"
          subtitle="Refresh these monthly. Everything else flows from these numbers."
        />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
          {[
            { key: "bucketVWCE",        label: "Growth · VWCE",     color: "var(--b-growth)" },
            { key: "bucketXEON",        label: "Safety · XEON",     color: "var(--b-fortress)" },
            { key: "bucketFixedIncome", label: "Stability · Bonds", color: "var(--b-fixed)" },
            { key: "bucketCash",        label: "Cash",              color: "var(--b-cash)" },
          ].map(b => (
            <NumberField
              key={b.key}
              label={b.label}
              value={state[b.key] || 0}
              onChange={(v) => updateState(b.key, v)}
              min={0} step={500}
              prefix="€" format={v => v.toLocaleString("en-GB")}
              accent={b.color}
            />
          ))}
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 12, color: "var(--fg-mute)" }}>
          Total portfolio: <strong style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(portfolio)}</strong>
        </div>
      </Card>

      {/* Allocation drift */}
      <Card>
        <SectionHeader
          eyebrow="Allocation"
          title="Targets vs. reality"
          subtitle={`How your buckets compare to ${phase.label} targets.`}
        />
        <Stack gap={18}>
          {buckets.map(b => {
            const value = state[b.key] || 0;
            const pct = portfolio > 0 ? (value / portfolio) * 100 : 0;
            const target = phase.buckets[b.phaseKey].target;
            const range = phase.buckets[b.phaseKey].range;
            const drift = pct - target;
            const inRange = pct >= range[0] && pct <= range[1];
            return (
              <div key={b.key}>
                <Row justify="space-between" align="baseline" style={{ marginBottom: 8 }}>
                  <Row gap={10}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: b.meta.color }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>{b.meta.label}</span>
                    <span style={{ fontSize: 11, color: "var(--fg-soft)" }}>{b.meta.sub}</span>
                  </Row>
                  <Row gap={10}>
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--fg)" }}>{pct.toFixed(1)}%</span>
                    <span style={{ fontSize: 11, color: "var(--fg-soft)", fontFamily: "var(--font-mono)" }}>target {target}%</span>
                    {!inRange && <Pill tone={drift > 0 ? "warn" : "default"} size="xs">{drift > 0 ? "+" : ""}{drift.toFixed(1)}</Pill>}
                  </Row>
                </Row>
                <DriftBar pct={pct} target={target} range={range} color={b.meta.raw} />
                <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 6 }}>{b.meta.short}</div>
              </div>
            );
          })}
        </Stack>
      </Card>

      {/* Income & spending — monthly, dual income, split expenses */}
      <Card>
        <SectionHeader
          eyebrow="Cashflow"
          title="Monthly income & spending"
          subtitle="The dashboard derives savings/withdrawal from these — no savings-rate slider needed."
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          {/* Income column */}
          <Stack gap={14}>
            <div style={{ fontSize: 11, color: "var(--fg-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Income (monthly net)</div>
            {showPrimarySalary && (
              <NumberField
                label="Your salary"
                value={state.monthlySalaryEUR || 0}
                onChange={(v) => updateState("monthlySalaryEUR", v)}
                min={0} step={100}
                prefix="€" format={v => v.toLocaleString("en-GB")}
              />
            )}
            {!showPrimarySalary && (
              <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10, fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5 }}>
                <strong>Your salary is paused</strong> — you're in {phase.label}. Switch phase above to re-enable.
              </div>
            )}
            <NumberField
              label="Partner's salary"
              value={state.monthlySalaryPartnerEUR || 0}
              onChange={(v) => updateState("monthlySalaryPartnerEUR", v)}
              min={0} step={100}
              prefix="€" format={v => v.toLocaleString("en-GB")}
            />
            <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
              <Row justify="space-between" align="baseline">
                <span style={{ fontSize: 12, color: "var(--fg-mute)" }}>Family income</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--good)", fontFamily: "var(--font-mono)" }}>{fmtEur(cf.incomeMonthly)}</span>
              </Row>
            </div>
          </Stack>

          {/* Spending column */}
          <Stack gap={14}>
            <div style={{ fontSize: 11, color: "var(--fg-soft)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Spending (monthly)</div>
            <NumberField
              label="Essentials"
              value={state.monthlyEssentialsEUR || 0}
              onChange={(v) => updateState("monthlyEssentialsEUR", v)}
              min={0} step={50}
              prefix="€" format={v => v.toLocaleString("en-GB")}
              hint="Rent, groceries, utilities, transport, insurance — non-negotiable."
            />
            <NumberField
              label="Fun budget"
              value={state.monthlyFunEUR || 0}
              onChange={(v) => updateState("monthlyFunEUR", v)}
              min={0} step={25}
              prefix="€" format={v => v.toLocaleString("en-GB")}
              hint="Travel, shopping, dining out — first lever to pull in lean times."
            />
            <div style={{ padding: "12px 14px", background: "var(--surface-2)", borderRadius: 10 }}>
              <Row justify="space-between" align="baseline">
                <span style={{ fontSize: 12, color: "var(--fg-mute)" }}>Total spending</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{fmtEur(cf.totalExpenses)}</span>
              </Row>
              <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 4 }}>
                Annualised {fmtEur(cf.annualExpenses)} · FIRE target {fmtEur(fireTarget)}
              </div>
            </div>
          </Stack>
        </div>

        {/* Surplus / shortfall summary */}
        <div style={{ marginTop: 18, padding: 16, background: cf.surplusMonthly >= 0 ? "var(--good-soft)" : "var(--warn-soft)", borderRadius: 12, border: `1px solid ${cf.surplusMonthly >= 0 ? "rgba(108,212,154,0.3)" : "rgba(245,184,107,0.3)"}` }}>
          <Row justify="space-between" align="baseline" wrap>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {cf.surplusMonthly >= 0 ? "Monthly surplus" : "Monthly shortfall"}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: cf.surplusMonthly >= 0 ? "var(--good)" : "var(--warn)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                {cf.surplusMonthly >= 0 ? "+" : "−"}{fmtEur(Math.abs(cf.surplusMonthly))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.6, maxWidth: 260, textAlign: isMobile ? "left" : "right" }}>
              {cf.surplusMonthly >= 0
                ? <>This is what flows to the portfolio each month. See <strong>Today</strong> for the bucket recommendation.</>
                : <>You're drawing down. See <strong>Today</strong> for which bucket to draw from.</>}
            </div>
          </Row>
        </div>
      </Card>

      {/* Assumptions */}
      <Card>
        <SectionHeader eyebrow="Assumptions" title="Returns & inflation" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
          <PrecisionSlider
            label="Expected nominal return"
            value={state.gkNominalReturn || 7.0}
            onChange={(v) => updateState("gkNominalReturn", v)}
            min={2} max={12} step={0.1} suffix="%"
            hint="Long-run annualised. VWCE ≈ 7–8% historically."
          />
          <PrecisionSlider
            label="Expected inflation"
            value={state.gkInflation || 2.0}
            onChange={(v) => updateState("gkInflation", v)}
            min={0} max={8} step={0.1} suffix="%"
            hint="ECB target 2%. Used to inflate withdrawals."
          />
          <PrecisionSlider
            label="Capital-gains tax"
            value={state.bgCgtRatePct || 10}
            onChange={(v) => updateState("bgCgtRatePct", v)}
            min={0} max={30} step={1} suffix="%"
            hint="Bulgarian default 10%. Shown as estimated CGT cost when forced to draw from VWCE."
          />
        </div>
      </Card>

      <Disclosure title="How the four buckets work together" icon="ⓘ">
        <p><strong>Growth</strong> is the engine — VWCE compounds for decades and is never sold during drawdowns.</p>
        <p><strong>Safety</strong> (XEON or similar €STR ETF) is the first line of defense — 2 years of expenses you can spend without touching equities. It's GK's "Bucket 1".</p>
        <p><strong>Stability</strong> (bonds or short-dated bond ETFs) is the second line — 5 years of expenses. It refills Safety. GK's "Bucket 2".</p>
        <p><strong>Cash</strong> is operating liquidity — 3–6 months of bills + opportunity money for buying drawdowns.</p>
        <p>The targets shift with your <em>phase</em>: while employed, you maximize Growth. In retirement, Safety and Stability grow to insulate Growth from sequence risk.</p>
      </Disclosure>
    </Stack>
  );
}

window.PlanView = PlanView;
