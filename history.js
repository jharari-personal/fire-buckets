// ─── HISTORY tab — record actuals year over year ───

function HistoryView({ state, setState }) {
  const { isMobile } = useViewport();
  const portfolio = (state.bucketVWCE||0) + (state.bucketXEON||0) + (state.bucketFixedIncome||0) + (state.bucketCash||0);
  const annualExpenses = ((state.monthlyEssentialsEUR || 0) + (state.monthlyFunEUR || 0)) * 12;
  const history = state.gkHistory || [];
  const lastWithdrawal = history.length > 0 ? history[history.length - 1].finalWithdrawal : annualExpenses;

  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({
    yearLabel: String(new Date().getFullYear()),
    portfolioStart: portfolio,
    actualReturn: 7,
    actualInflation: 2.5,
  });

  const preview = useMemo(() => calcGKNextStep({
    portfolio: draft.portfolioStart,
    lastWithdrawal,
    annualNominalReturn: draft.actualReturn / 100,
    inflation: draft.actualInflation / 100,
  }), [draft, lastWithdrawal]);

  const save = () => {
    const entry = {
      id: Date.now(),
      yearLabel: draft.yearLabel,
      portfolioStart: draft.portfolioStart,
      actualReturn: draft.actualReturn,
      actualInflation: draft.actualInflation,
      lastWithdrawal,
      proposedWithdrawal: preview.proposedWithdrawal,
      finalWithdrawal: preview.finalWithdrawal,
      trigger: preview.trigger,
      wr: preview.wr * 100,
      timestamp: new Date().toISOString(),
    };
    setState(s => ({ ...s, gkHistory: [...(s.gkHistory || []), entry] }));
    setShowAdd(false);
    setDraft({ ...draft, yearLabel: String(Number(draft.yearLabel) + 1) });
  };

  const remove = (id) => {
    if (window.confirm("Remove this entry?")) {
      setState(s => ({ ...s, gkHistory: (s.gkHistory || []).filter(e => e.id !== id) }));
    }
  };

  return (
    <Stack gap={isMobile ? 16 : 20}>
      <Card>
        <SectionHeader
          eyebrow="Year-end log"
          title="What actually happened"
          subtitle="Each year, record what the portfolio did. The plan adjusts from real data, not assumptions."
          action={
            <Button tone={showAdd ? "secondary" : "primary"} size="md" onClick={() => {
              setShowAdd(!showAdd);
              if (!showAdd) setDraft(d => ({ ...d, portfolioStart: portfolio }));
            }}>
              {showAdd ? "Cancel" : "+ Record year"}
            </Button>
          }
        />

        {showAdd && (
          <Card tone="inset" padding={18} style={{ marginBottom: 18 }}>
            <Stack gap={16}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--fg-mute)", marginBottom: 8, fontWeight: 500 }}>Year label</div>
                  <input
                    value={draft.yearLabel}
                    onChange={(e) => setDraft({ ...draft, yearLabel: e.target.value })}
                    style={{ width: "100%", padding: "11px 14px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, color: "var(--fg)", fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 600, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                <NumberField
                  label="Portfolio at year start"
                  value={draft.portfolioStart}
                  onChange={(v) => setDraft({ ...draft, portfolioStart: v })}
                  min={0} step={1000}
                  prefix="€" format={v => v.toLocaleString("en-GB")}
                />
              </div>
              <PrecisionSlider
                label="Actual return"
                value={draft.actualReturn}
                onChange={(v) => setDraft({ ...draft, actualReturn: v })}
                min={-30} max={30} step={0.5} suffix="%"
                format={v => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)}
              />
              <PrecisionSlider
                label="Actual inflation"
                value={draft.actualInflation}
                onChange={(v) => setDraft({ ...draft, actualInflation: v })}
                min={0} max={10} step={0.1} suffix="%"
              />

              <Card tone="default" padding={14}>
                <Stack gap={6}>
                  <Row justify="space-between"><span style={{ fontSize: 12, color: "var(--fg-soft)" }}>Last withdrawal base</span><span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-mute)" }}>{fmtEur(lastWithdrawal)}/yr</span></Row>
                  <Row justify="space-between"><span style={{ fontSize: 12, color: "var(--fg-soft)" }}>Inflation-adjusted</span><span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-mute)" }}>{fmtEur(preview.proposedWithdrawal)}/yr</span></Row>
                  {preview.trigger && (
                    <Row justify="space-between">
                      <span style={{ fontSize: 12, color: "var(--fg-soft)" }}>GK rule</span>
                      <Pill tone={preview.trigger === "PROSPERITY" ? "accent" : "bad"} size="sm">
                        {preview.trigger === "PROSPERITY" ? "↑ Prosperity +10%" : "↓ Cut −10%"}
                      </Pill>
                    </Row>
                  )}
                  <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 8 }}>
                    <Row justify="space-between" align="baseline">
                      <span style={{ fontSize: 12, color: "var(--fg-mute)", fontWeight: 600 }}>Proposed for next year</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: getGKZone(preview.wr * 100).color, fontFamily: "var(--font-mono)" }}>
                        {fmtEur(preview.finalWithdrawal)}
                      </span>
                    </Row>
                    <div style={{ fontSize: 11, color: "var(--fg-soft)", textAlign: "right", marginTop: 2 }}>WR {(preview.wr * 100).toFixed(2)}%</div>
                  </div>
                </Stack>
              </Card>

              <Button tone="primary" size="lg" full onClick={save}>Save entry</Button>
            </Stack>
          </Card>
        )}

        {history.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--fg-soft)", fontSize: 13, lineHeight: 1.6 }}>
            No entries yet.<br />
            <span style={{ fontSize: 12 }}>Record a year to start tracking how the GK rule adjusts your withdrawals.</span>
          </div>
        ) : (
          <Stack gap={10}>
            {[...history].reverse().map(entry => {
              const zone = getGKZone(entry.wr);
              return (
                <div key={entry.id} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 12, border: "1px solid var(--hairline)" }}>
                  <Row justify="space-between" align="flex-start" gap={10} style={{ marginBottom: 10 }}>
                    <Row gap={10}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{entry.yearLabel}</span>
                      {entry.trigger && (
                        <Pill tone={entry.trigger === "PROSPERITY" ? "accent" : "bad"} size="xs">
                          {entry.trigger === "PROSPERITY" ? "Prosperity ↑" : "Cut ↓"}
                        </Pill>
                      )}
                    </Row>
                    <button onClick={() => remove(entry.id)} style={{ background: "transparent", border: "none", color: "var(--fg-soft)", fontSize: 12, cursor: "pointer", padding: 4 }}>Remove</button>
                  </Row>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>Portfolio</div>
                      <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{fmtEurK(entry.portfolioStart)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>Return</div>
                      <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: entry.actualReturn >= 0 ? "var(--good)" : "var(--bad)" }}>
                        {entry.actualReturn >= 0 ? "+" : ""}{entry.actualReturn.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>Withdrew</div>
                      <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{fmtEur(entry.finalWithdrawal)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--fg-soft)" }}>WR</div>
                      <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: zone.color }}>{entry.wr.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </Stack>
        )}
      </Card>

      <Disclosure title="Why log every year?" icon="ⓘ">
        <p>The GK rule isn't a forecast — it's a feedback loop. It looks at last year's withdrawal and compares the resulting rate against guardrails. Without a history, the rule has no baseline to adjust from.</p>
        <p>Once a year (any time, just be consistent), record the portfolio value at year start, the actual market return, and the actual inflation. The app computes next year's safe withdrawal automatically.</p>
      </Disclosure>
    </Stack>
  );
}

window.HistoryView = HistoryView;
