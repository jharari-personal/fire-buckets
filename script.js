// ─── Compass FIRE Planner — App shell ───
// New IA: Today · Plan · Stress · History
// Settings (incl. Cloud sync) lives behind a clear button in the header.

const DEFAULT_STATE = {
  // Buckets
  bucketVWCE: 240000,
  bucketXEON: 28000,
  bucketFixedIncome: 23000,
  bucketCash: 12000,

  // Personal — monthly figures
  monthlyEssentialsEUR: 2042,
  monthlyFunEUR: 708,
  monthlySalaryEUR: 8750,
  monthlySalaryPartnerEUR: 0,

  // Phase
  currentPhase: "employed",

  // Assumptions
  gkNominalReturn: 7.0,
  gkInflation: 2.0,
  bgCgtRatePct: 0.0,

  // History
  gkHistory: [],

  // Settings
  cloudGistId: "",
  cloudToken: "",
  showAdvanced: false,
};

function SettingsSheet({ open, onClose, state, setState }) {
  const [draftToken, setDraftToken] = useState(state.cloudToken || "");
  const [draftGistId, setDraftGistId] = useState(state.cloudGistId || "");
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { if (open) { setDraftToken(state.cloudToken || ""); setDraftGistId(state.cloudGistId || ""); setSyncStatus(null); } }, [open, state.cloudToken, state.cloudGistId]);

  const updateState = (k, v) => setState(s => ({ ...s, [k]: v }));

  const cloudSave = async () => {
    if (!draftToken) { setSyncStatus({ type: "bad", msg: "Token required" }); return; }
    setSyncing(true);
    try {
      const newGistId = await saveToGist(draftToken, draftGistId, state);
      setState(s => ({ ...s, cloudToken: draftToken, cloudGistId: newGistId }));
      setDraftGistId(newGistId);
      setSyncStatus({ type: "good", msg: "Saved to GitHub Gist" });
    } catch (e) { setSyncStatus({ type: "bad", msg: e.message }); }
    setSyncing(false);
  };

  const cloudLoad = async () => {
    if (!draftToken || !draftGistId) { setSyncStatus({ type: "bad", msg: "Token and Gist ID required" }); return; }
    if (!window.confirm("Replace local state with cloud version?")) return;
    setSyncing(true);
    try {
      const data = await loadFromGist(draftToken, draftGistId);
      setState(s => ({ ...s, ...data, cloudToken: draftToken, cloudGistId: draftGistId }));
      setSyncStatus({ type: "good", msg: "Loaded from GitHub Gist" });
    } catch (e) { setSyncStatus({ type: "bad", msg: e.message }); }
    setSyncing(false);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fire-state-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (window.confirm("Replace current state with imported data?")) {
          setState(s => ({ ...s, ...data }));
        }
      } catch { alert("Invalid JSON"); }
    };
    reader.readAsText(file);
  };

  const reset = () => {
    if (!window.confirm("Reset everything to defaults? This cannot be undone.")) return;
    if (!window.confirm("Are you absolutely sure?")) return;
    setState({ ...DEFAULT_STATE });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Settings" size="md">
      <Stack gap={24}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Cloud sync</div>
          <div style={{ fontSize: 12, color: "var(--fg-mute)", lineHeight: 1.5, marginBottom: 14 }}>
            Sync state across devices via a private GitHub Gist. Your data never touches our servers — it's stored under your own GitHub account.
          </div>
          <Stack gap={12}>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)", marginBottom: 6 }}>GitHub personal access token (gist scope)</div>
              <input
                type="password" value={draftToken} onChange={e => setDraftToken(e.target.value)}
                placeholder="ghp_…"
                style={{ width: "100%", padding: "11px 14px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, color: "var(--fg)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--fg-soft)", marginBottom: 6 }}>Gist ID (optional — leave empty to create new)</div>
              <input
                value={draftGistId} onChange={e => setDraftGistId(e.target.value)}
                placeholder="auto-generated on first save"
                style={{ width: "100%", padding: "11px 14px", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, color: "var(--fg)", fontSize: 13, fontFamily: "var(--font-mono)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <Row gap={10}>
              <Button tone="primary" full onClick={cloudSave} disabled={syncing}>{syncing ? "Saving…" : "Save to cloud"}</Button>
              <Button tone="secondary" full onClick={cloudLoad} disabled={syncing || !draftGistId}>Load from cloud</Button>
            </Row>
            {syncStatus && (
              <div style={{ padding: "10px 14px", background: syncStatus.type === "good" ? "var(--good-soft)" : "var(--bad-soft)", borderRadius: 10, fontSize: 12, color: syncStatus.type === "good" ? "var(--good)" : "var(--bad)" }}>
                {syncStatus.msg}
              </div>
            )}
          </Stack>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 14 }}>Local backup</div>
          <Row gap={10}>
            <Button tone="secondary" full onClick={exportJSON}>Export JSON</Button>
            <label style={{ flex: 1 }}>
              <input type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
              <Button tone="secondary" full onClick={(e) => e.currentTarget.previousSibling.click()}>Import JSON</Button>
            </label>
          </Row>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 14 }}>Danger zone</div>
          <Button tone="danger" full onClick={reset}>Reset to defaults</Button>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 16, fontSize: 11, color: "var(--fg-soft)", lineHeight: 1.6, textAlign: "center" }}>
          Compass · v{APP_VERSION}<br />
          State auto-saves locally · Update buckets monthly
        </div>
      </Stack>
    </Sheet>
  );
}

function Header({ onSettings, isMobile, currentPhase }) {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 20,
      background: "rgba(11,12,15,0.85)",
      backdropFilter: "blur(20px) saturate(180%)",
      borderBottom: "1px solid var(--hairline)",
      padding: isMobile ? "12px 16px" : "16px 32px",
    }}>
      <Row justify="space-between" align="center">
        <Row gap={12} align="center">
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent), #4d6fc4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, color: "#0b0c0f", fontSize: 14, fontFamily: "var(--font-display)",
          }}>C</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.01em", lineHeight: 1.1 }}>Compass</div>
            <div style={{ fontSize: 10, color: "var(--fg-soft)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>FIRE planner</div>
          </div>
        </Row>
        <Row gap={8} align="center">
          {!isMobile && <Pill tone="ghost" size="sm">{PHASES[currentPhase]?.label || "Setup"}</Pill>}
          <button
            onClick={onSettings}
            aria-label="Settings"
            style={{
              width: 38, height: 38, borderRadius: 10,
              background: "var(--surface-1)", border: "1px solid var(--hairline)",
              color: "var(--fg-mute)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="settings" size={16} />
          </button>
        </Row>
      </Row>
    </header>
  );
}

function App() {
  const { isMobile } = useViewport();
  const [state, setState, loaded] = usePersistedState(DEFAULT_STATE);
  const [tab, setTab] = useState("today");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tabs = [
    { id: "today",   label: "Today",   icon: <Icon name="today"   size={isMobile ? 20 : 14} /> },
    { id: "plan",    label: "Plan",    icon: <Icon name="layers"  size={isMobile ? 20 : 14} /> },
    { id: "stress",  label: "Stress",  icon: <Icon name="chart"   size={isMobile ? 20 : 14} /> },
    { id: "history", label: "History", icon: <Icon name="history" size={isMobile ? 20 : 14} /> },
  ];

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-soft)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }

  const View = { today: TodayView, plan: PlanView, stress: StressView, history: HistoryView }[tab];

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header onSettings={() => setSettingsOpen(true)} isMobile={isMobile} currentPhase={state.currentPhase} />

      {!isMobile && (
        <div style={{
          background: "var(--bg)", borderBottom: "1px solid var(--hairline)",
          padding: "16px 32px", display: "flex", justifyContent: "center",
        }}>
          <TabBar value={tab} onChange={setTab} tabs={tabs} isMobile={false} />
        </div>
      )}

      <main style={{
        maxWidth: 1080, margin: "0 auto",
        padding: isMobile ? "16px 16px 96px" : "28px 32px 48px",
      }}>
        <div key={tab} className="fade-in">
          <View state={state} setState={setState} />
        </div>
      </main>

      {isMobile && <TabBar value={tab} onChange={setTab} tabs={tabs} isMobile={true} />}

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} setState={setState} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
