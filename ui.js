// ─── Compass UI — design-system primitives ───
// Calm, low-chrome components. The goal: legibility first, ornament never.

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

// ── Layout ────────────────────────────────────────────────────────────────

function Stack({ gap = 16, children, style, ...rest }) {
  return <div style={{ display: "flex", flexDirection: "column", gap, ...style }} {...rest}>{children}</div>;
}

function Row({ gap = 12, align = "center", justify = "flex-start", wrap = false, children, style, ...rest }) {
  return <div style={{ display: "flex", flexDirection: "row", gap, alignItems: align, justifyContent: justify, flexWrap: wrap ? "wrap" : "nowrap", ...style }} {...rest}>{children}</div>;
}

// ── Card ──────────────────────────────────────────────────────────────────

function Card({ children, style, padding = 20, tone = "default", interactive = false, onClick, ...rest }) {
  const tones = {
    default: { background: "var(--surface-1)", border: "1px solid var(--hairline)" },
    inset:   { background: "var(--bg)",        border: "1px solid var(--hairline)" },
    raised:  { background: "var(--surface-2)", border: "1px solid var(--hairline-strong)" },
    accent:  { background: "linear-gradient(180deg, rgba(122,162,255,0.08), rgba(122,162,255,0.02))", border: "1px solid rgba(122,162,255,0.25)" },
  };
  return (
    <div
      onClick={onClick}
      className={interactive ? "hover-lift" : undefined}
      style={{
        ...tones[tone],
        borderRadius: "var(--radius-l)",
        padding,
        boxShadow: tone === "default" || tone === "raised" ? "var(--shadow-soft)" : "none",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle, action, level = 2 }) {
  return (
    <Row justify="space-between" align="flex-end" style={{ marginBottom: 16 }} wrap>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 11, color: "var(--fg-soft)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>{eyebrow}</div>}
        <div style={{ fontSize: level === 1 ? 28 : 18, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--fg-mute)", marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      {action}
    </Row>
  );
}

// ── KPI / stat ────────────────────────────────────────────────────────────

function Stat({ label, value, sub, tone = "default", size = "md", trend, footnote }) {
  const sizes = {
    sm: { v: 18, l: 11 },
    md: { v: 26, l: 12 },
    lg: { v: 38, l: 12 },
    xl: { v: 56, l: 13 },
  };
  const s = sizes[size];
  const toneColor = {
    default: "var(--fg)",
    accent:  "var(--accent)",
    good:    "var(--good)",
    warn:    "var(--warn)",
    bad:     "var(--bad)",
    mute:    "var(--fg-mute)",
  }[tone];
  return (
    <div>
      {label && <div style={{ fontSize: s.l, color: "var(--fg-soft)", marginBottom: 6, fontWeight: 500 }}>{label}</div>}
      <div style={{ fontSize: s.v, color: toneColor, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, fontFeatureSettings: '"tnum","cv11"' }}>
        {value}
        {trend != null && (
          <span style={{ fontSize: s.v * 0.5, color: trend >= 0 ? "var(--good)" : "var(--bad)", marginLeft: 8, fontWeight: 500 }}>
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--fg-mute)", marginTop: 6 }}>{sub}</div>}
      {footnote && <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 4 }}>{footnote}</div>}
    </div>
  );
}

// ── Pill / Badge ──────────────────────────────────────────────────────────

function Pill({ tone = "default", children, size = "sm", style }) {
  const tones = {
    default: { bg: "var(--surface-2)",                color: "var(--fg-mute)",  border: "var(--hairline)" },
    accent:  { bg: "rgba(122,162,255,0.12)",          color: "var(--accent)",   border: "rgba(122,162,255,0.30)" },
    good:    { bg: "rgba(108,212,154,0.12)",          color: "var(--good)",     border: "rgba(108,212,154,0.30)" },
    warn:    { bg: "rgba(245,184,107,0.12)",          color: "var(--warn)",     border: "rgba(245,184,107,0.30)" },
    bad:     { bg: "rgba(239,115,115,0.12)",          color: "var(--bad)",      border: "rgba(239,115,115,0.30)" },
    ghost:   { bg: "transparent",                      color: "var(--fg-soft)", border: "var(--hairline)" },
  };
  const t = tones[tone] || tones.default;
  const sizes = {
    xs: { padding: "2px 7px", fontSize: 10 },
    sm: { padding: "3px 9px", fontSize: 11 },
    md: { padding: "5px 12px", fontSize: 12 },
  };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: t.bg, color: t.color,
      border: `1px solid ${t.border}`, borderRadius: 999,
      fontWeight: 600, letterSpacing: "0.01em",
      ...sizes[size], ...style,
    }}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────

function Button({ tone = "secondary", size = "md", children, onClick, disabled, style, full, type = "button", icon, ...rest }) {
  const tones = {
    primary:   { bg: "var(--accent)",         fg: "#0b0c0f",         border: "var(--accent)",     hover: "var(--accent-deep)" },
    secondary: { bg: "var(--surface-2)",      fg: "var(--fg)",       border: "var(--hairline)",   hover: "var(--surface-3)"   },
    ghost:     { bg: "transparent",           fg: "var(--fg-mute)",  border: "transparent",       hover: "var(--surface-1)"   },
    danger:    { bg: "var(--bad-soft)",       fg: "var(--bad)",      border: "rgba(239,115,115,0.3)", hover: "rgba(239,115,115,0.18)" },
    success:   { bg: "var(--good-soft)",      fg: "var(--good)",     border: "rgba(108,212,154,0.3)", hover: "rgba(108,212,154,0.18)" },
  };
  const sizes = {
    sm: { padding: "6px 12px",  fontSize: 12, height: 30 },
    md: { padding: "9px 16px",  fontSize: 13, height: 38 },
    lg: { padding: "12px 22px", fontSize: 14, height: 46 },
  };
  const t = tones[tone];
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        background: hover && !disabled ? t.hover : t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        fontWeight: 600, letterSpacing: "0",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        width: full ? "100%" : undefined,
        transition: "background 140ms ease, transform 80ms ease",
        userSelect: "none", whiteSpace: "nowrap",
        ...sizes[size], ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// ── Stepper / Tap-to-edit number input (mobile-first) ─────────────────────

function NumberField({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, suffix = "", prefix = "", format, hint, accent = "var(--accent)", help }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const display = format ? format(value) : value.toLocaleString("en-GB", { maximumFractionDigits: step < 1 ? 2 : 0 });

  const commit = () => {
    const n = Number(draft.replace(/[^0-9.\-]/g, ""));
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };

  const adj = (delta) => onChange(Math.min(max, Math.max(min, +(value + delta).toFixed(6))));

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  return (
    <div>
      {label && (
        <Row justify="space-between" align="center" style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "var(--fg-mute)", fontWeight: 500 }}>{label}</span>
          {help && <Pill tone="ghost" size="xs">{help}</Pill>}
        </Row>
      )}
      <Row gap={0} style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden", height: 44 }}>
        <button
          onClick={() => adj(-step)}
          style={{ width: 44, height: 44, background: "transparent", border: "none", color: "var(--fg-mute)", fontSize: 18, cursor: "pointer", borderRight: "1px solid var(--hairline)", touchAction: "manipulation" }}
        >−</button>
        <div
          onClick={() => { setDraft(String(value)); setEditing(true); }}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", cursor: "text", padding: "0 8px", minWidth: 0 }}
        >
          {editing ? (
            <input
              ref={inputRef}
              type="text" inputMode="decimal" enterKeyHint="done"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              style={{ width: "100%", textAlign: "center", background: "transparent", border: "none", outline: "none", color: "var(--fg)", fontSize: 16, fontFamily: "var(--font-mono)", fontWeight: 600 }}
            />
          ) : (
            <span style={{ color: "var(--fg)", fontSize: 16, fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {prefix}{display}{suffix}
            </span>
          )}
        </div>
        <button
          onClick={() => adj(step)}
          style={{ width: 44, height: 44, background: "transparent", border: "none", color: "var(--fg-mute)", fontSize: 18, cursor: "pointer", borderLeft: "1px solid var(--hairline)", touchAction: "manipulation" }}
        >+</button>
      </Row>
      {hint && <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

// ── Slider with editable numeric companion ───────────────────────────────

function PrecisionSlider({ label, value, onChange, min, max, step = 1, suffix = "", prefix = "", format, accent = "var(--accent)", hint }) {
  const display = format ? format(value) : `${prefix}${value}${suffix}`;
  const pct = ((value - min) / (max - min)) * 100;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  const commit = () => {
    const n = Number(draft.replace(/[^0-9.\-]/g, ""));
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setEditing(false);
  };

  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editing]);

  return (
    <div>
      <Row justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "var(--fg-mute)", fontWeight: 500 }}>{label}</span>
        {editing ? (
          <input
            ref={inputRef}
            type="text" inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            style={{ width: 80, textAlign: "right", background: "var(--surface-2)", border: `1px solid ${accent}`, borderRadius: 6, color: "var(--fg)", fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, padding: "4px 8px" }}
          />
        ) : (
          <button
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            style={{ background: "transparent", border: "none", padding: "2px 6px", borderRadius: 6, color: accent, fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", cursor: "text" }}
          >
            {display}
          </button>
        )}
      </Row>
      <input
        type="range" min={min} max={max} step={step}
        value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%", height: 36, margin: 0,
          WebkitAppearance: "none", appearance: "none",
          background: `linear-gradient(to right, ${accent} 0%, ${accent} ${pct}%, var(--surface-3) ${pct}%, var(--surface-3) 100%)`,
          borderRadius: 999, outline: "none", cursor: "pointer",
        }}
      />
      {hint && <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 4 }}>{hint}</div>}
      <style>{`
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--fg); border: 3px solid var(--bg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        }
        input[type=range]::-moz-range-thumb {
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--fg); border: 3px solid var(--bg);
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        }
      `}</style>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, hint }) {
  return (
    <Row justify="space-between" align="center" gap={12}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {label && <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>{label}</div>}
        {hint && <div style={{ fontSize: 11, color: "var(--fg-soft)", marginTop: 2 }}>{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 999,
          background: value ? "var(--accent)" : "var(--surface-3)",
          border: "1px solid " + (value ? "var(--accent)" : "var(--hairline)"),
          position: "relative", cursor: "pointer", padding: 0,
          transition: "background 160ms ease",
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 999, background: "#fff",
          position: "absolute", top: 2, left: value ? 20 : 2,
          transition: "left 160ms ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
      </button>
    </Row>
  );
}

// ── Segmented control ─────────────────────────────────────────────────────

function Segmented({ value, onChange, options, full = true, size = "md" }) {
  const heights = { sm: 30, md: 38, lg: 44 };
  return (
    <div style={{
      display: "inline-flex", padding: 3,
      background: "var(--surface-2)", border: "1px solid var(--hairline)",
      borderRadius: 999, height: heights[size],
      width: full ? "100%" : undefined,
    }}>
      {options.map(opt => {
        const o = typeof opt === "string" ? { id: opt, label: opt } : opt;
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              flex: full ? 1 : undefined,
              padding: "0 14px",
              border: "none", borderRadius: 999,
              background: active ? "var(--surface-3)" : "transparent",
              color: active ? "var(--fg)" : "var(--fg-soft)",
              fontSize: size === "sm" ? 11 : 13, fontWeight: 600,
              cursor: "pointer", transition: "all 140ms ease",
              boxShadow: active ? "0 1px 0 rgba(255,255,255,0.04), 0 1px 4px rgba(0,0,0,0.3)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Disclosure (info collapsible) ─────────────────────────────────────────

function Disclosure({ title, icon = "ⓘ", children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: "1px solid var(--hairline)", borderRadius: 12, background: "var(--surface-1)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", textAlign: "left", padding: "12px 16px",
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          color: "var(--fg-mute)", fontSize: 12, fontWeight: 500,
        }}
      >
        <Row gap={10}>
          <span style={{ color: "var(--fg-soft)", fontSize: 14 }}>{icon}</span>
          <span>{title}</span>
        </Row>
        <span style={{ color: "var(--fg-soft)", fontSize: 12, transition: "transform 200ms ease", transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 14px 42px", color: "var(--fg-mute)", fontSize: 12, lineHeight: 1.6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Sheet (mobile drawer) / Modal ─────────────────────────────────────────

function Sheet({ open, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onEsc); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 380, md: 540, lg: 720 };
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "fade 200ms ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: widths[size],
          background: "var(--surface-1)",
          borderTop: "1px solid var(--hairline-strong)",
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          maxHeight: "92vh", overflowY: "auto",
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          animation: "fadeUp 240ms cubic-bezier(.2,.9,.3,1)",
        }}
      >
        <div style={{
          position: "sticky", top: 0, background: "var(--surface-1)",
          borderBottom: "1px solid var(--hairline)",
          padding: "14px 20px", zIndex: 1,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--hairline-strong)", position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)" }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", marginTop: 6 }}>{title}</div>
          <button onClick={onClose} style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: 8, color: "var(--fg-mute)", width: 32, height: 32, marginTop: 6, cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ── Tab bar (responsive: bottom on mobile, top on desktop) ───────────────

function TabBar({ value, onChange, tabs, isMobile }) {
  if (isMobile) {
    return (
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(11,12,15,0.85)", backdropFilter: "blur(20px) saturate(180%)",
        borderTop: "1px solid var(--hairline)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        zIndex: 30,
      }}>
        <Row justify="space-around" gap={0}>
          {tabs.map(t => {
            const active = value === t.id;
            return (
              <button
                key={t.id} onClick={() => onChange(t.id)}
                style={{
                  flex: 1, padding: "10px 4px 8px",
                  background: "transparent", border: "none",
                  color: active ? "var(--accent)" : "var(--fg-soft)",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.02em",
                }}
              >
                <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </Row>
      </nav>
    );
  }
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--surface-1)", border: "1px solid var(--hairline)", borderRadius: 999 }}>
      {tabs.map(t => {
        const active = value === t.id;
        return (
          <button
            key={t.id} onClick={() => onChange(t.id)}
            style={{
              padding: "8px 18px",
              background: active ? "var(--surface-3)" : "transparent",
              border: "none", borderRadius: 999,
              color: active ? "var(--fg)" : "var(--fg-mute)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              transition: "all 160ms ease",
            }}
          >
            <span style={{ fontSize: 14, opacity: active ? 1 : 0.65 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Icons (inline SVG, single-stroke, calm) ──────────────────────────────

const Icon = ({ name, size = 16, stroke = 1.6, color = "currentColor" }) => {
  const paths = {
    today:    "M3 7h18M5 4v3m14-3v3M3 11h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z",
    plan:     "M3 18l5-7 4 4 8-11M14 4h7v7",
    stress:   "M3 12h3l3-9 4 18 3-9h5",
    history:  "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    cloud:    "M18 10a6 6 0 0 0-11.7-2A4.5 4.5 0 0 0 7 17h11a4 4 0 0 0 0-7z",
    info:     "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 8h.01M11 12h1v5h1",
    arrow:    "M5 12h14M13 5l7 7-7 7",
    plus:     "M12 5v14M5 12h14",
    minus:    "M5 12h14",
    check:    "M5 13l4 4L19 7",
    close:    "M6 6l12 12M18 6L6 18",
    edit:     "M11 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    chart:    "M21 21H4.6a.6.6 0 0 1-.6-.6V3M7 14l4-4 4 4 5-5",
    target:   "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12zM12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
    bell:     "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    upload:   "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    refresh:  "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
    sparkle:  "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
    flag:     "M4 22V4M4 4h13l-2 4 2 4H4",
    trash:    "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z",
    chevronDown: "M6 9l6 6 6-6",
    search:   "M11 17a6 6 0 1 1 0-12 6 6 0 0 1 0 12zM21 21l-5-5",
    layers:   "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={paths[name] || paths.info} />
    </svg>
  );
};

// ── Hook: viewport ────────────────────────────────────────────────────────

function useViewport() {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onR = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return { ...vp, isMobile: vp.w < 760, isTablet: vp.w >= 760 && vp.w < 1100, isDesktop: vp.w >= 1100 };
}

// ── Hook: persistent state ───────────────────────────────────────────────

function usePersistedState(initialState) {
  const [state, setState] = useState(initialState);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const saved = await loadState();
      if (saved) setState((prev) => ({ ...prev, ...saved }));
      setLoaded(true);
    })();
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => saveState(state), 250);
    return () => clearTimeout(t);
  }, [state, loaded]);
  return [state, setState, loaded];
}

Object.assign(window, {
  Stack, Row, Card, SectionHeader, Stat, Pill, Button,
  NumberField, PrecisionSlider, Toggle, Segmented, Disclosure, Sheet, TabBar, Icon,
  useViewport, usePersistedState,
});
