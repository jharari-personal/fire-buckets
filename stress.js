// ─── STRESS-TEST tab — sequence risk, Monte Carlo, GK 40-yr projection ───
// Charts are pure SVG (no library deps).

function FanChart({ bands, height = 260, valueFmt = fmtEurK }) {
  const { isMobile } = useViewport();
  const padL = 50, padR = 14, padT = 14, padB = 28;
  const w = isMobile ? 320 : 640;
  const h = height;
  if (!bands || bands.length === 0) return null;

  const maxV = Math.max(...bands.map(b => b.p90), 1);
  const minV = Math.min(0, ...bands.map(b => b.p10));
  const xs = (i) => padL + (i / Math.max(1, bands.length - 1)) * (w - padL - padR);
  const ys = (v) => padT + (h - padT - padB) * (1 - (v - minV) / (maxV - minV));

  const pathFor = (key) => bands.map((b, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(b[key])}`).join(" ");
  const areaBetween = (kHi, kLo) => {
    const top = bands.map((b, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(b[kHi])}`).join(" ");
    const bot = bands.slice().reverse().map((b, i) => `L${xs(bands.length - 1 - i)},${ys(b[kLo])}`).join(" ");
    return `${top} ${bot} Z`;
  };

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => minV + (i / yTicks) * (maxV - minV));

  return (
    <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", minWidth: w }}>
        {/* Y grid */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={ys(v)} x2={w - padR} y2={ys(v)} stroke="var(--hairline)" strokeWidth={1} strokeDasharray={i === 0 ? "" : "2 4"} />
            <text x={padL - 8} y={ys(v) + 4} fontSize={10} fill="var(--fg-soft)" textAnchor="end" fontFamily="var(--font-mono)">{valueFmt(v)}</text>
          </g>
        ))}
        {/* Bands */}
        <path d={areaBetween("p90", "p10")} fill="rgba(122,162,255,0.10)" />
        <path d={areaBetween("p75", "p25")} fill="rgba(122,162,255,0.18)" />
        {/* Median */}
        <path d={pathFor("p50")} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" />
        {/* P10 line, dashed */}
        <path d={pathFor("p10")} fill="none" stroke="var(--bad)" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.7} />
        {/* X labels (decade marks) */}
        {bands.filter(b => b.year === 1 || b.year % 10 === 0 || b.year === bands.length).map(b => {
          const i = b.year - 1;
          return (
            <text key={b.year} x={xs(i)} y={h - 8} fontSize={10} fill="var(--fg-soft)" textAnchor="middle" fontFamily="var(--font-mono)">
              Yr {b.year}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function GKLineChart({ rows, height = 220 }) {
  const { isMobile } = useViewport();
  const padL = 50, padR = 14, padT = 14, padB = 28;
  const w = isMobile ? 320 : 640;
  const h = height;
  if (!rows || rows.length === 0) return null;

  const maxV = Math.max(...rows.map(r => r.portfolioEnd), 1);
  const xs = (i) => padL + (i / Math.max(1, rows.length - 1)) * (w - padL - padR);
  const ys = (v) => padT + (h - padT - padB) * (1 - v / maxV);

  const linePath = rows.map((r, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(r.portfolioEnd)}`).join(" ");
  const areaPath = `${linePath} L${xs(rows.length - 1)},${ys(0)} L${xs(0)},${ys(0)} Z`;

  const yTicks = 4;
  const tickVals = Array.from({ length: yTicks + 1 }, (_, i) => (i / yTicks) * maxV);

  return (
    <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", minWidth: w }}>
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={padL} y1={ys(v)} x2={w - padR} y2={ys(v)} stroke="var(--hairline)" strokeWidth={1} strokeDasharray={i === 0 ? "" : "2 4"} />
            <text x={padL - 8} y={ys(v) + 4} fontSize={10} fill="var(--fg-soft)" textAnchor="end" fontFamily="var(--font-mono)">{fmtEurK(v)}</text>
          </g>
        ))}
        <path d={areaPath} fill="rgba(108,212,154,0.10)" />
        <path d={linePath} fill="none" stroke="var(--good)" strokeWidth={2.2} strokeLinejoin="round" />
        {/* Trigger dots */}
        {rows.map((r, i) => {
          if (!r.trigger || r.trigger === "DEPLETED") return null;
          const color = r.trigger === "PROSPERITY" ? "var(--accent)" : "var(--bad)";
          return <circle key={i} cx={xs(i)} cy={ys(r.portfolioEnd)} r={3} fill={color} />;
        })}
        {rows.filter(r => r.year === 1 || r.year % 10 === 0 || r.year === rows.length).map(r => {
          const i = r.year - 1;
          return (
            <text key={r.year} x={xs(i)} y={h - 8} fontSize={10} fill="var(--fg-soft)" textAnchor="middle" fontFamily="var(--font-mono)">Yr {r.year}</text>
          );
        })}
      </svg>
    </div>
  );
}

function StressView({ state, setState }) {
  const { isMobile } = useViewport();
  // Use deriveCashflow so annualExpenses is consistent with all other tabs
  const cf = deriveCashflow(state);
  const annualExpenses = cf.annualExpenses;
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  const equityShare = portfolio > 0 ? (state.bucketVWCE||0) / portfolio : 0.7;

  // gkNominalReturn is the *portfolio-blended* expected return (set in Plan).
  // For MC we need the *equity-only* return, derived from the blend:
  //   portfolioReturn = equityShare·equityMu + (1−equityShare)·bondMu
  //   equityMu = (portfolioReturn − (1−equityShare)·bondMu) / equityShare
  const bondMuFixed = 0.03;
  const portfolioReturn = (state.gkNominalReturn || 7) / 100;
  const equityMuForMC = equityShare > 0.01
    ? (portfolioReturn - (1 - equityShare) * bondMuFixed) / equityShare
    : portfolioReturn;

  const [mcEquitySigma, setMcEquitySigma] = useState(15.0);
  const [mcInflationSigma, setMcInflationSigma] = useState(1.5);
  const [mcRho, setMcRho] = useState(0.0);
  const [mcPaths, setMcPaths] = useState(1000);
  const [mcResult, setMcResult] = useState(null);
  const [mcRunning, setMcRunning] = useState(false);

  // Linear projection uses portfolio-blended return (gkNominalReturn)
  const gkRows = useMemo(() => runGKSimulation({
    startPortfolio: portfolio,
    startWithdrawal: annualExpenses,
    nominalReturn: portfolioReturn,
    inflation: (state.gkInflation || 2) / 100,
    years: 40,
  }), [portfolio, annualExpenses, portfolioReturn, state.gkInflation]);

  const handleRunMC = () => {
    setMcRunning(true);
    setTimeout(() => {
      const result = runMonteCarlo({
        startPortfolio: portfolio,
        startWithdrawal: annualExpenses,
        equityShare,
        equityMu: equityMuForMC,
        equitySigma: mcEquitySigma / 100,
        bondMu: bondMuFixed, bondSigma: 0.04,
        inflationTarget: (state.gkInflation || 2) / 100,
        inflationSigma: mcInflationSigma / 100,
        rhoEquityBond: mcRho,
        years: 40, paths: mcPaths,
      });
      setMcResult(result);
      setMcRunning(false);
    }, 50);
  };

  // Key milestone years
  const milestones = gkRows.filter(r => [1, 5, 10, 20, 30, 40].includes(r.year));

  return (
    <Stack gap={isMobile ? 16 : 20}>
      <Card>
        <SectionHeader
          eyebrow="Linear projection"
          title="40 years on a steady path"
          subtitle={`Constant ${(state.gkNominalReturn || 7).toFixed(1)}% nominal return, ${(state.gkInflation || 2).toFixed(1)}% inflation. Reality is bumpier — see Monte Carlo below.`}
        />
        <GKLineChart rows={gkRows} height={isMobile ? 200 : 240} />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: 8, marginTop: 16 }}>
          {milestones.map(m => (
            <div key={m.year} style={{ padding: 10, background: "var(--surface-2)", borderRadius: 10, border: "1px solid var(--hairline)" }}>
              <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>Year {m.year}</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: m.portfolioEnd > 0 ? "var(--fg)" : "var(--bad)", marginTop: 3 }}>
                {m.portfolioEnd > 0 ? fmtEurK(m.portfolioEnd) : "Depleted"}
              </div>
              <div style={{ fontSize: 10, color: "var(--fg-soft)", marginTop: 2, fontFamily: "var(--font-mono)" }}>WR {m.wr.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader
          eyebrow="Monte Carlo"
          title="What if returns aren't smooth?"
          subtitle={`Run ${mcPaths.toLocaleString()} random 40-year sequences to see how often the plan survives.`}
          action={
            <Button tone="primary" size="md" onClick={handleRunMC} disabled={mcRunning}>
              {mcRunning ? "Running…" : (mcResult ? "Re-run" : "Run simulation")}
            </Button>
          }
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          <PrecisionSlider label="Equity volatility (σ)" value={mcEquitySigma} onChange={setMcEquitySigma} min={8} max={30} step={0.5} suffix="%" />
          <PrecisionSlider label="Inflation volatility (σ)" value={mcInflationSigma} onChange={setMcInflationSigma} min={0.5} max={5} step={0.1} suffix="%" />
          <PrecisionSlider label="Stock-bond correlation (ρ)" value={mcRho} onChange={setMcRho} min={-0.6} max={0.8} step={0.05} format={v => v.toFixed(2)} hint="0 = independent; +0.4 = 2022-style regime" />
          <PrecisionSlider label="Number of paths" value={mcPaths} onChange={setMcPaths} min={200} max={3000} step={200} format={v => v.toLocaleString()} />
        </div>

        {mcResult ? (
          <Stack gap={16}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              <Card padding={16} tone="inset" style={{ borderColor: mcResult.successRate >= 0.95 ? "rgba(108,212,154,0.4)" : mcResult.successRate >= 0.85 ? "rgba(245,184,107,0.4)" : "rgba(239,115,115,0.4)" }}>
                <Stat
                  label="Success rate"
                  value={`${(mcResult.successRate * 100).toFixed(1)}%`}
                  tone={mcResult.successRate >= 0.95 ? "good" : mcResult.successRate >= 0.85 ? "warn" : "bad"}
                  size="lg"
                  footnote="Paths ending above zero"
                />
              </Card>
              <Card padding={16} tone="inset">
                <Stat
                  label="Cut rule fires"
                  value={`${(mcResult.preservationCutRate * 100).toFixed(1)}%`}
                  tone="warn" size="lg"
                  footnote="Paths needing ≥1 cut in first 10 years"
                />
              </Card>
              <Card padding={16} tone="inset">
                <Stat
                  label="Median ending balance"
                  value={fmtEurK(mcResult.bands[mcResult.bands.length - 1].p50)}
                  size="lg"
                  footnote={`Nominal at year ${mcResult.bands.length}`}
                />
              </Card>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12 }}>
              <Card padding={16} tone="inset">
                <Stat
                  label="CVaR (worst 10%)"
                  value={fmtEurK(mcResult.cvar10)}
                  tone={mcResult.cvar10 < 0 ? "bad" : "default"}
                  size="lg"
                  footnote="Mean balance in the worst-decile paths"
                />
              </Card>
              {mcResult.medianDepletionYear != null ? (
                <Card padding={16} tone="inset" style={{ borderColor: "rgba(239,115,115,0.4)" }}>
                  <Stat
                    label="Median depletion"
                    value={`Year ${mcResult.medianDepletionYear}`}
                    tone="bad" size="lg"
                    footnote={`Median year depleted in ${((1 - mcResult.successRate) * 100).toFixed(0)}% of failed paths`}
                  />
                </Card>
              ) : (
                <Card padding={16} tone="inset" style={{ borderColor: "rgba(108,212,154,0.4)" }}>
                  <Stat
                    label="Depletion"
                    value="None"
                    tone="good" size="lg"
                    footnote="No paths depleted in this run"
                  />
                </Card>
              )}
            </div>

            <FanChart bands={mcResult.bands} height={isMobile ? 220 : 280} />

            <Row gap={16} wrap>
              <Row gap={8}><div style={{ width: 14, height: 3, background: "var(--accent)" }} /><span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Median (P50)</span></Row>
              <Row gap={8}><div style={{ width: 14, height: 8, background: "rgba(122,162,255,0.18)" }} /><span style={{ fontSize: 11, color: "var(--fg-mute)" }}>P25–P75</span></Row>
              <Row gap={8}><div style={{ width: 14, height: 8, background: "rgba(122,162,255,0.10)" }} /><span style={{ fontSize: 11, color: "var(--fg-mute)" }}>P10–P90</span></Row>
              <Row gap={8}><div style={{ width: 14, height: 0, borderTop: "1.5px dashed var(--bad)" }} /><span style={{ fontSize: 11, color: "var(--fg-mute)" }}>Worst 10% (P10)</span></Row>
            </Row>
          </Stack>
        ) : !mcRunning && (
          <div style={{ padding: 20, background: "var(--surface-2)", borderRadius: 12, textAlign: "center", color: "var(--fg-mute)", fontSize: 13 }}>
            Press <strong style={{ color: "var(--accent)" }}>Run simulation</strong> to stress-test the plan against random return sequences.
          </div>
        )}
      </Card>

      <Disclosure title="Why Monte Carlo matters more than the linear projection" icon="ⓘ">
        <p>The linear chart above shows what happens if returns are perfectly steady — they never are. The same average return delivered in a different <em>order</em> can produce wildly different outcomes when you're withdrawing money. This is "sequence-of-returns risk".</p>
        <p>Monte Carlo runs thousands of random orderings and reports how often the portfolio survives. A success rate above 95% with the cut rule firing in fewer than 30% of paths is a healthy plan.</p>
      </Disclosure>
    </Stack>
  );
}

window.StressView = StressView;
window.FanChart = FanChart;
window.GKLineChart = GKLineChart;
