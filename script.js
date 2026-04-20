const { useState, useMemo, useEffect } = React;

const PHASES = {
  employed_early: {
    label: "Employed · Accumulating",
    subtitle: "Portfolio < €500k",
    growth: { target: 84, range: [82, 87], note: "Single provider (VWCE) acceptable" },
    fortress: { target: 7, range: [6, 8], floor: 30000, note: "~16-18 months expenses" },
    termShield: { target: 5, range: [4, 6], floor: 18000, note: "29GA until Q1 2029, then reassess" },
    cash: { target: 4, range: [0, 5], note: "DCA deployment buffer — drive toward 0%" },
    satellite: { target: 0, range: [0, 0], note: "Not yet — every euro has a job" },
  },
  employed_mid: {
    label: "Employed · Approaching FIRE",
    subtitle: "Portfolio €500k–€625k",
    growth: { target: 82, range: [80, 84], note: "Split new flows: 60% VWCE / 40% SPYI or ISAC" },
    fortress: { target: 8, range: [7, 9], floor: 40000, note: "~22-24 months expenses" },
    termShield: { target: 5, range: [4, 6], floor: 18000, note: "29GA or successor instrument" },
    cash: { target: 3, range: [1, 4], note: "Monthly salary inflow buffer only" },
    satellite: { target: 2, range: [0, 3], note: "Optional — only if conviction is high" },
  },
  employed_fire: {
    label: "Employed · FIRE-Ready",
    subtitle: "Portfolio > €625k, still working",
    growth: { target: 78, range: [75, 80], note: "Multi-provider. Begin considering 5% small-cap tilt" },
    fortress: { target: 9, range: [8, 10], floor: 50000, note: "24+ months expenses locked" },
    termShield: { target: 6, range: [5, 7], floor: 25000, note: "Years 2-4 bridge" },
    cash: { target: 3, range: [2, 4], note: "Opportunity fund — deploy on 15%+ drawdowns" },
    satellite: { target: 4, range: [2, 5], note: "Conviction plays OK — max 2 positions" },
  },
  laid_off: {
    label: "Laid Off · Fortress Mode",
    subtitle: "No income — protect and survive",
    growth: { target: 82, range: [78, 85], note: "DO NOT SELL. Freeze. Let it compound." },
    fortress: { target: 10, range: [8, 12], floor: 30000, note: "Draw first. Replenish from severance." },
    termShield: { target: 5, range: [4, 7], floor: 18000, note: "Draw second, after fortress depleted" },
    cash: { target: 3, range: [1, 5], note: "Severance lands here → flows to fortress/term" },
    satellite: { target: 0, range: [0, 0], note: "Liquidate satellites → fortress if they exist" },
  },
  post_fire: {
    label: "Post-FIRE · Decumulation",
    subtitle: "Living off the portfolio",
    growth: { target: 70, range: [65, 75], note: "Multi-provider mandatory. Rebalance annually." },
    fortress: { target: 12, range: [10, 14], floor: 50000, note: "24-30 months expenses. Non-negotiable." },
    termShield: { target: 10, range: [8, 12], floor: 35000, note: "Years 2-4 rolling ladder" },
    cash: { target: 4, range: [3, 5], note: "3-6 months immediate liquidity" },
    satellite: { target: 4, range: [2, 5], note: "Fun money. Conviction bets. Capped." },
  },
};

const BUCKET_META = {
  growth: {
    label: "Growth Engine",
    instruments: "VWCE → VWCE + SPYI/ISAC",
    color: "#2563eb",
    role: "Long-term wealth compounding. Never sell in a drawdown. This is the engine.",
  },
  fortress: {
    label: "Fortress Cash",
    instruments: "XEON (€STR tracker)",
    color: "#059669",
    role: "Immediate liquidity. Layoff runway years 0-2. Draw first in unemployment.",
  },
  termShield: {
    label: "Term Shield",
    instruments: "29GA → successor bond ETF",
    color: "#d97706",
    role: "Medium-term runway years 2-4. Higher yield than XEON. Sell before dissolution.",
  },
  cash: {
    label: "Strategic Cash",
    instruments: "EUR cash at IBKR",
    color: "#6b7280",
    role: "DCA deployment buffer or opportunity fund. Target: drive toward zero in accumulation.",
  },
  satellite: {
    label: "Satellite / Conviction",
    instruments: "Individual stocks, thematic ETFs",
    color: "#7c3aed",
    role: "Optional. Max 2-3 positions. Only when core framework is fully funded.",
  },
};

const TRIGGERS = [
  {
    event: "Layoff confirmed",
    action: "Switch to \"Laid Off\" phase. Cancel DCA. Route cash → XEON. Do not sell VWCE.",
    urgency: "immediate",
  },
  {
    event: "Portfolio hits €500k",
    action: "Switch to \"Approaching FIRE\". Split new DCA: 60% VWCE / 40% second provider (SPYI or ISAC).",
    urgency: "this_month",
  },
  {
    event: "Portfolio hits €625k",
    action: "Switch to \"FIRE-Ready\". Fortress floor increases to €50k. Begin building satellite if desired.",
    urgency: "this_month",
  },
  {
    event: "VWCE exceeds €500k",
    action: "All new equity flows go to SPYI/ISAC until VWCE drops below 60% of equity bucket.",
    urgency: "this_month",
  },
  {
    event: "€STR drops below 1.5%",
    action: "Review XEON. Consider shifting fortress to short-dated EUR govt bond ETF for better yield.",
    urgency: "this_quarter",
  },
  {
    event: "Bulgaria removes Art. 13 exemption",
    action: "No immediate portfolio change needed (reset already done). Activate Spain/Beckham playbook within 60 days.",
    urgency: "this_quarter",
  },
  {
    event: "March 2029 — 29GA dissolution approaching",
    action: "Sell 29GA on BVME.ETF via directed limit order. Replace with next-maturity bond ETF or add to XEON.",
    urgency: "immediate",
  },
  {
    event: "Market drawdown > 25%",
    action: "Deploy strategic cash into growth. Do NOT sell fortress or term shield. This is what the buffer is for.",
    urgency: "this_week",
  },
  {
    event: "New child or major life expense",
    action: "Increase fortress floor by €10-15k. Delay FIRE target by recalculating at 3.5% SWR on higher expense base.",
    urgency: "this_month",
  },
  {
    event: "Wife begins earning income",
    action: "Reduce fortress floor by ~50% of her annual income. Accelerate growth allocation. Recalculate FIRE number.",
    urgency: "this_quarter",
  },
];

function Bar({ value, max, color, height = 28 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{
      width: "100%", height, background: "#1a1a1a", borderRadius: 4, overflow: "hidden", position: "relative",
    }}>
      <div style={{
        width: `${pct}%`, height: "100%", background: color, borderRadius: 4,
        transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8,
      }}>
        {pct > 12 && (
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "monospace" }}>
            {value}%
          </span>
        )}
      </div>
      {pct <= 12 && (
        <span style={{
          position: "absolute", left: `calc(${pct}% + 6px)`, top: "50%", transform: "translateY(-50%)",
          color: "#999", fontSize: 12, fontWeight: 600, fontFamily: "monospace",
        }}>
          {value}%
        </span>
      )}
    </div>
  );
}

function RangeIndicator({ target, range, color }) {
  const [lo, hi] = range;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#888", fontFamily: "monospace" }}>
      <span>{lo}%</span>
      <div style={{ flex: 1, height: 6, background: "#1a1a1a", borderRadius: 3, position: "relative" }}>
        <div style={{
          position: "absolute", left: `${lo}%`, width: `${hi - lo}%`, height: "100%",
          background: `${color}33`, borderRadius: 3,
        }} />
        <div style={{
          position: "absolute", left: `${target}%`, top: -2, width: 3, height: 10,
          background: color, borderRadius: 2, transform: "translateX(-50%)",
        }} />
      </div>
      <span>{hi}%</span>
    </div>
  );
}

function BucketCard({ bucketKey, phase, portfolioValue }) {
  const meta = BUCKET_META[bucketKey];
  const alloc = phase[bucketKey];
  const floorEur = alloc.floor ? Math.max(alloc.floor, 0) : null;
  const targetEur = Math.round(portfolioValue * alloc.target / 100);
  const floorActive = floorEur && targetEur < floorEur;

  return (
    <div style={{
      background: "#111", border: "1px solid #222", borderRadius: 8, padding: "16px 18px",
      borderLeft: `3px solid ${meta.color}`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#eee", letterSpacing: "-0.01em" }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{meta.instruments}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: meta.color, fontFamily: "monospace", lineHeight: 1 }}>
            {alloc.target}%
          </div>
          <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>
            €{targetEur.toLocaleString()}
          </div>
        </div>
      </div>

      <Bar value={alloc.target} max={100} color={meta.color} />

      <div style={{ marginTop: 8 }}>
        <RangeIndicator target={alloc.target} range={alloc.range} color={meta.color} />
      </div>

      <div style={{ fontSize: 12, color: "#aaa", marginTop: 10, lineHeight: 1.5 }}>
        {alloc.note}
      </div>

      {floorEur && (
        <div style={{
          marginTop: 8, padding: "6px 10px", borderRadius: 4,
          background: floorActive ? "#7c2d1233" : "#1a1a1a",
          border: floorActive ? "1px solid #b91c1c44" : "1px solid #333",
          fontSize: 11, fontFamily: "monospace",
          color: floorActive ? "#f87171" : "#888",
        }}>
          Hard floor: €{floorEur.toLocaleString()}
          {floorActive && " ⚠ Target below floor — allocate to floor, not %"}
        </div>
      )}

      <div style={{ fontSize: 11, color: "#555", marginTop: 8, fontStyle: "italic" }}>
        {meta.role}
      </div>
    </div>
  );
}

function UrgencyBadge({ urgency }) {
  const styles = {
    immediate: { bg: "#7f1d1d", text: "#fca5a5", label: "ACT NOW" },
    this_week: { bg: "#78350f", text: "#fcd34d", label: "THIS WEEK" },
    this_month: { bg: "#1e3a5f", text: "#93c5fd", label: "THIS MONTH" },
    this_quarter: { bg: "#1a2e1a", text: "#86efac", label: "THIS QUARTER" },
  };
  const s = styles[urgency] || styles.this_month;
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4,
      background: s.bg, color: s.text, fontSize: 10, fontWeight: 700,
      fontFamily: "monospace", letterSpacing: "0.05em",
    }}>
      {s.label}
    </span>
  );
}

function PortfolioFramework() {
  const [activePhase, setActivePhase] = useState("employed_early");
  const [portfolioValue, setPortfolioValue] = useState(451000);
  const [showTriggers, setShowTriggers] = useState(false);

  const phase = PHASES[activePhase];
  const bucketKeys = ["growth", "fortress", "termShield", "cash", "satellite"];

  const totalTarget = bucketKeys.reduce((sum, k) => sum + phase[k].target, 0);

  const phaseButtons = [
    { key: "employed_early", short: "Accumulating", icon: "▲" },
    { key: "employed_mid", short: "Near FIRE", icon: "◆" },
    { key: "employed_fire", short: "FIRE-Ready", icon: "★" },
    { key: "laid_off", short: "Laid Off", icon: "■" },
    { key: "post_fire", short: "Post-FIRE", icon: "●" },
  ];

  const sliderStops = [300, 400, 451, 500, 550, 600, 625, 650, 700, 800, 900, 1000];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#ddd",
      fontFamily: "'IBM Plex Sans', 'SF Pro Text', -apple-system, sans-serif",
      padding: "24px 20px",
    }}>
      {/* Header */}
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "#555",
            textTransform: "uppercase", fontFamily: "monospace",
          }}>
            PORTFOLIO ALLOCATION FRAMEWORK
          </span>
        </div>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1.2,
          letterSpacing: "-0.03em",
        }}>
          Four-Bucket System
        </h1>
        <p style={{ fontSize: 13, color: "#666", margin: "6px 0 24px", lineHeight: 1.5 }}>
          Targets shift based on life phase — not market conditions.
          Pick your current phase. Adjust portfolio value. Follow the numbers.
        </p>

        {/* Phase Selector */}
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20,
        }}>
          {phaseButtons.map((p) => (
            <button
              key={p.key}
              onClick={() => setActivePhase(p.key)}
              style={{
                padding: "8px 14px", borderRadius: 6, border: "1px solid",
                borderColor: activePhase === p.key ? "#fff" : "#333",
                background: activePhase === p.key ? "#fff" : "transparent",
                color: activePhase === p.key ? "#000" : "#888",
                fontSize: 12, fontWeight: activePhase === p.key ? 700 : 500,
                cursor: "pointer", transition: "all 0.2s",
                fontFamily: "inherit",
              }}
            >
              <span style={{ marginRight: 5 }}>{p.icon}</span>
              {p.short}
            </button>
          ))}
        </div>

        {/* Phase Info */}
        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: 8,
          padding: "14px 18px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{phase.label}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{phase.subtitle}</div>
        </div>

        {/* Portfolio Value Slider */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, color: "#888" }}>Portfolio Value</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>
              €{portfolioValue.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={200000}
            max={1200000}
            step={5000}
            value={portfolioValue}
            onChange={(e) => setPortfolioValue(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#2563eb" }}
          />
          <div style={{
            display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555",
            fontFamily: "monospace", marginTop: 2,
          }}>
            <span>€200k</span>
            <span>€500k</span>
            <span>€625k</span>
            <span>€1M+</span>
          </div>
        </div>

        {/* Allocation Total Check */}
        {totalTarget !== 100 && (
          <div style={{
            padding: "8px 12px", background: "#7f1d1d33", border: "1px solid #b91c1c44",
            borderRadius: 6, fontSize: 12, color: "#f87171", marginBottom: 16, fontFamily: "monospace",
          }}>
            ⚠ Targets sum to {totalTarget}% — adjust to 100%
          </div>
        )}

        {/* Bucket Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {bucketKeys.map((k) => (
            <BucketCard key={k} bucketKey={k} phase={phase} portfolioValue={portfolioValue} />
          ))}
        </div>

        {/* Summary Bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Combined Allocation</div>
          <div style={{
            display: "flex", height: 32, borderRadius: 6, overflow: "hidden", border: "1px solid #333",
          }}>
            {bucketKeys.map((k) => {
              const alloc = phase[k];
              const meta = BUCKET_META[k];
              return alloc.target > 0 ? (
                <div
                  key={k}
                  style={{
                    width: `${alloc.target}%`, background: meta.color, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                    borderRight: "1px solid #0a0a0a",
                  }}
                >
                  {alloc.target >= 8 && (
                    <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: "monospace" }}>
                      {alloc.target}%
                    </span>
                  )}
                </div>
              ) : null;
            })}
          </div>
          <div style={{
            display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap",
          }}>
            {bucketKeys.filter(k => phase[k].target > 0).map((k) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: 2, background: BUCKET_META[k].color,
                }} />
                <span style={{ fontSize: 11, color: "#888" }}>{BUCKET_META[k].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trigger Events */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => setShowTriggers(!showTriggers)}
            style={{
              background: "transparent", border: "1px solid #333", borderRadius: 6,
              padding: "10px 16px", color: "#aaa", fontSize: 13, cursor: "pointer",
              width: "100%", textAlign: "left", fontFamily: "inherit",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600 }}>Life Event Triggers ({TRIGGERS.length})</span>
            <span style={{ fontSize: 18, transition: "transform 0.2s", transform: showTriggers ? "rotate(180deg)" : "rotate(0)" }}>
              ▾
            </span>
          </button>

          {showTriggers && (
            <div style={{
              marginTop: 8, display: "flex", flexDirection: "column", gap: 6,
            }}>
              {TRIGGERS.map((t, i) => (
                <div
                  key={i}
                  style={{
                    background: "#111", border: "1px solid #222", borderRadius: 6,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                    gap: 12, marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#eee" }}>{t.event}</span>
                    <UrgencyBadge urgency={t.urgency} />
                  </div>
                  <div style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>{t.action}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rules */}
        <div style={{
          background: "#111", border: "1px solid #222", borderRadius: 8,
          padding: "18px 20px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
            Hard Rules (Never Break)
          </div>
          {[
            "Fortress has a euro FLOOR, not just a percentage. If the % target gives less than the floor, fund to the floor.",
            "Never sell Growth Engine in a drawdown. That's what Fortress and Term Shield exist for.",
            "Rebalance with new money, not by selling. The only exception: post-FIRE annual rebalance.",
            "All sells direct-routed to IBIS/IBIS2 or BVME.ETF. No exceptions. No SMART routing on sells.",
            "Satellite is capped at target %. No \"just this once\" overweights. If conviction is that high, increase target via framework review.",
            "Review this framework annually in September. Do not change allocations mid-year on impulse.",
          ].map((rule, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, marginBottom: 10, fontSize: 12, color: "#bbb", lineHeight: 1.5,
            }}>
              <span style={{ color: "#555", fontFamily: "monospace", fontWeight: 700, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{rule}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24, paddingTop: 16, borderTop: "1px solid #1a1a1a",
          fontSize: 11, color: "#444", lineHeight: 1.6,
        }}>
          Framework designed for: Joseph Harari · U15566654 · Bulgarian tax resident ·
          FIRE target €625k (3.5% SWR on €22k/yr expenses) · Last updated April 20, 2026.
          Not financial advice. Percentages are targets with acceptable ranges — not precision
          constraints. The floor matters more than the percentage.
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<PortfolioFramework />);