import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Eye, EyeOff, AlertTriangle, CheckCircle2, Terminal, Zap, Lock,
  Wand2, RefreshCw, Copy, Check, ArrowDown, Save, LogIn, LayoutDashboard, ShieldAlert,
} from "lucide-react";
import { analyze } from "@/lib/password-analyzer";
import { generatePassword, type GenOptions } from "@/lib/password-generator";
import { useAuth } from "@/hooks/use-auth";
import { sha256Hex } from "@/lib/hash";
import { checkBreach } from "@/lib/breach";
import { useServerFn } from "@tanstack/react-start";
import { checkReuse, savePassword } from "@/lib/history.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Password Strength Analyzer — Audit & Attack Simulator" },
      {
        name: "description",
        content:
          "Evaluate password entropy, simulate brute-force attack vectors, and audit security strength locally in your browser.",
      },
      { property: "og:title", content: "Password Strength Analyzer" },
      { property: "og:description", content: "Evaluate security strength & simulate attack vectors." },
    ],
  }),
  component: Index,
});

const SCORE_COLORS = [
  "oklch(0.65 0.24 25)",
  "oklch(0.7 0.22 40)",
  "oklch(0.82 0.18 75)",
  "oklch(0.75 0.18 145)",
  "oklch(0.82 0.21 155)",
];

const COMPOSITION_COLORS: Record<string, string> = {
  lowercase: "var(--cyan)",
  uppercase: "var(--violet)",
  digits: "var(--warning)",
  symbols: "var(--magenta)",
};

function attackColor(seconds: number): string {
  if (seconds < 1) return "var(--destructive)";
  if (seconds < 3600) return "oklch(0.7 0.22 40)";
  if (seconds < 86400 * 30) return "var(--warning)";
  if (seconds < 86400 * 365 * 10) return "var(--cyan)";
  return "var(--primary)";
}

function Index() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const result = useMemo(() => analyze(pw), [pw]);
  const hasInput = pw.length > 0;
  const scoreColor = SCORE_COLORS[result.score];
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const checkReuseFn = useServerFn(checkReuse);
  const saveFn = useServerFn(savePassword);
  const qc = useQueryClient();
  const [breachCount, setBreachCount] = useState<number | null>(null);
  const [reused, setReused] = useState<boolean>(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced breach + reuse check
  useEffect(() => {
    if (!pw) { setBreachCount(null); setReused(false); return; }
    const handle = setTimeout(async () => {
      const count = await checkBreach(pw);
      setBreachCount(count);
      if (user) {
        try {
          const hash = await sha256Hex(pw);
          const r = await checkReuseFn({ data: { hash } });
          setReused(r.reused);
        } catch { /* ignore */ }
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [pw, user, checkReuseFn]);

  const copyPw = async () => {
    if (!pw) return;
    await navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const save = async () => {
    if (!user) { navigate({ to: "/auth" }); return; }
    setSaving(true);
    try {
      const hash = await sha256Hex(pw);
      await saveFn({
        data: {
          hash, label: label || undefined,
          entropy: result.entropy, score: result.score, length: result.length,
          breached: (breachCount ?? 0) > 0,
        },
      });
      qc.invalidateQueries({ queryKey: ["history"] });
      toast.success("Saved to history (hash only)");
      setLabel("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-5xl">
        {/* Top nav */}
        <nav className="flex justify-end mb-4 text-xs font-mono">
          {user ? (
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary/10 transition">
              <LayoutDashboard size={12} /> Dashboard
            </Link>
          ) : (
            <Link to="/auth" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border hover:border-primary text-foreground hover:text-primary transition">
              <LogIn size={12} /> Sign in
            </Link>
          )}
        </nav>

        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 text-2xl md:text-4xl font-bold tracking-tight">
            <Shield className="text-primary drop-shadow-[0_0_8px_var(--primary)]" size={36} />
            <h1 className="font-mono">
              Password <span className="text-primary">Strength</span> Analyzer
            </h1>
          </div>
          <p className="mt-3 text-xs md:text-sm text-muted-foreground tracking-widest uppercase">
            <span className="cursor-blink">Evaluate security strength &amp; simulate attack vectors</span>
          </p>
        </header>

        {/* Input panel */}
        <section
          className="rounded-lg border border-primary/40 bg-card/60 backdrop-blur p-5 md:p-6 terminal-glow-soft"
          style={{ animation: hasInput ? "pulse-glow 2.4s ease-in-out infinite" : undefined }}
        >
          <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground flex items-center gap-2">
            <Terminal size={12} /> Enter Password
          </label>
          <div className="relative mt-2">
            <input
              type={show ? "text" : "password"}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Type your password here..."
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-input/60 border border-border rounded-md px-4 py-3 pr-12 font-mono text-base md:text-lg text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition"
              aria-label="Toggle visibility"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle size={12} /> Processed locally. Never stored or transmitted.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={copyPw}
              disabled={!pw}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded border border-border hover:border-primary text-muted-foreground hover:text-primary transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setPw("")}
              disabled={!pw}
              className="text-[11px] px-2.5 py-1.5 rounded border border-border hover:border-destructive text-muted-foreground hover:text-destructive transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Breach + reuse alerts */}
        {hasInput && (breachCount !== null || reused) && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {breachCount !== null && breachCount > 0 && (
              <div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm flex items-start gap-2">
                <ShieldAlert size={14} className="text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="font-mono text-destructive">Found in breach database</div>
                  <div className="text-[11px] text-muted-foreground">
                    Seen {breachCount.toLocaleString()} times in known leaks (HaveIBeenPwned). Don't use this password.
                  </div>
                </div>
              </div>
            )}
            {breachCount === 0 && (
              <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm flex items-start gap-2">
                <CheckCircle2 size={14} className="text-primary mt-0.5 shrink-0" />
                <div className="font-mono text-primary">Not in known breaches</div>
              </div>
            )}
            {reused && (
              <div className="rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-sm flex items-start gap-2">
                <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
                <div>
                  <div className="font-mono text-warning">You've used this before</div>
                  <div className="text-[11px] text-muted-foreground">Pick something new — reuse defeats the purpose.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save to history */}
        {hasInput && (
          <div className="mt-4 rounded-md border border-border bg-card/40 p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={user ? "Label (e.g. work email)" : "Sign in to save"}
              disabled={!user}
              className="flex-1 bg-input/60 border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary disabled:opacity-50"
            />
            <button
              onClick={save}
              disabled={saving || !pw}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded border border-primary/60 text-primary hover:bg-primary/10 text-xs font-mono uppercase tracking-widest transition disabled:opacity-50"
            >
              <Save size={12} /> {user ? "Save hash" : "Sign in to save"}
            </button>
          </div>
        )}

        {/* Password Generator */}
        <GeneratorPanel onUse={(p) => setPw(p)} />

        {hasInput && (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* Strength meter */}
            <Panel title="Strength Assessment" icon={<Zap size={14} />}>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono" style={{ color: scoreColor }}>
                  {result.label}
                </span>
                <span className="text-xs text-muted-foreground">SCORE {result.score}/4</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-2 rounded-sm transition-all duration-300"
                    style={{
                      backgroundColor: i <= result.score ? SCORE_COLORS[result.score] : "oklch(0.25 0.025 240)",
                      boxShadow: i <= result.score ? `0 0 10px ${SCORE_COLORS[result.score]}` : undefined,
                    }}
                  />
                ))}
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm font-mono">
                <Stat label="Length" value={result.length.toString()} />
                <Stat label="Entropy" value={`${result.entropy.toFixed(1)} bits`} />
                <Stat label="Charset" value={`${result.charsetSize}`} />
                <Stat label="Combos" value={`2^${result.entropy.toFixed(0)}`} />
              </dl>
            </Panel>

            {/* Character composition */}
            <Panel title="Character Composition" icon={<Lock size={14} />}>
              <div className="space-y-2.5">
                {result.composition.map((c) => {
                  const pct = Math.min(100, (c.count / Math.max(1, result.length)) * 100);
                  const color = COMPOSITION_COLORS[c.type] ?? "var(--primary)";
                  return (
                    <div key={c.type}>
                      <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
                        <span className="uppercase tracking-wider">{c.type}</span>
                        <span style={{ color: c.count > 0 ? color : undefined }}>{c.count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color,
                            boxShadow: c.count > 0 ? `0 0 6px ${color}` : undefined,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Attack simulation */}
            <Panel title="Attack Vector Simulation" icon={<Terminal size={14} />} className="md:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-normal">Scenario</th>
                      <th className="text-right py-2 font-normal">Guesses/sec</th>
                      <th className="text-right py-2 font-normal">Time to crack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.crackTimes.map((c) => (
                      <tr key={c.scenario} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5">$ {c.scenario}</td>
                        <td className="py-2.5 text-right text-muted-foreground">
                          {c.guessesPerSec.toExponential(0)}
                        </td>
                        <td className="py-2.5 text-right">
                          <span style={{ color: attackColor(c.seconds) }}>{c.display}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <Panel title="Vulnerabilities Detected" icon={<AlertTriangle size={14} />} accent="destructive">
                <ul className="space-y-2 text-sm">
                  {result.warnings.map((w) => (
                    <li key={w} className="flex gap-2 text-destructive-foreground">
                      <span className="text-destructive">[!]</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <Panel
                title="Hardening Recommendations"
                icon={<CheckCircle2 size={14} />}
                className={result.warnings.length === 0 ? "md:col-span-2" : ""}
              >
                <ul className="space-y-2 text-sm">
                  {result.suggestions.map((s) => (
                    <li key={s} className="flex gap-2">
                      <span className="text-primary">{">"}</span>
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}

        <footer className="mt-12 text-center text-[10px] text-muted-foreground tracking-widest uppercase">
          <span className="text-primary">●</span> Client-side cryptanalysis · Only hashes ever leave your browser
        </footer>
      </div>
    </main>
  );
}

function Panel({
  title,
  icon,
  children,
  className = "",
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  accent?: "destructive";
}) {
  const borderColor = accent === "destructive" ? "border-destructive/50" : "border-border";
  return (
    <section
      className={`rounded-lg border ${borderColor} bg-card/60 backdrop-blur p-5 ${className}`}
    >
      <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
        <span className={accent === "destructive" ? "text-destructive" : "text-primary"}>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border/60 rounded px-3 py-2 bg-background/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function GeneratorPanel({ onUse }: { onUse: (pw: string) => void }) {
  const [opts, setOpts] = useState<GenOptions>({
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [generated, setGenerated] = useState<string>(() =>
    generatePassword({ length: 20, lower: true, upper: true, digits: true, symbols: true, excludeAmbiguous: false })
  );
  const [copied, setCopied] = useState(false);

  const regen = (next: GenOptions = opts) => {
    setGenerated(generatePassword(next));
    setCopied(false);
  };
  const update = <K extends keyof GenOptions>(key: K, value: GenOptions[K]) => {
    const next = { ...opts, [key]: value };
    setOpts(next);
    regen(next);
  };
  const copy = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggles: { key: keyof GenOptions; label: string; color: string }[] = [
    { key: "lower", label: "a-z", color: "var(--cyan)" },
    { key: "upper", label: "A-Z", color: "var(--violet)" },
    { key: "digits", label: "0-9", color: "var(--warning)" },
    { key: "symbols", label: "!@#", color: "var(--magenta)" },
  ];

  return (
    <section className="mt-6 rounded-lg border border-primary/40 bg-card/60 backdrop-blur p-5 md:p-6">
      <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
        <Wand2 size={14} className="text-primary" />
        Secure Password Generator
      </h2>

      <div className="flex items-center gap-2 rounded-md border border-border bg-input/60 px-3 py-2.5">
        <code className="flex-1 font-mono text-sm md:text-base text-foreground break-all">
          {generated || "—"}
        </code>
        <button
          onClick={() => regen()}
          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted transition"
          aria-label="Regenerate"
        >
          <RefreshCw size={16} />
        </button>
        <button
          onClick={copy}
          className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-muted transition"
          aria-label="Copy"
        >
          {copied ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            <span>Length</span>
            <span className="text-primary font-mono">{opts.length}</span>
          </div>
          <input
            type="range"
            min={6}
            max={64}
            value={opts.length}
            onChange={(e) => update("length", Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toggles.map((t) => {
            const active = opts[t.key] as boolean;
            return (
              <button
                key={t.key}
                onClick={() => update(t.key, !active as never)}
                className="px-2.5 py-1.5 rounded-md border text-xs font-mono transition"
                style={{
                  borderColor: active ? t.color : "var(--border)",
                  color: active ? t.color : "var(--muted-foreground)",
                  boxShadow: active ? `0 0 8px ${t.color}` : undefined,
                }}
              >
                {t.label}
              </button>
            );
          })}
          <label className="ml-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={opts.excludeAmbiguous}
              onChange={(e) => update("excludeAmbiguous", e.target.checked)}
              className="accent-[var(--primary)]"
            />
            Exclude ambiguous
          </label>
        </div>
      </div>

      <button
        onClick={() => generated && onUse(generated)}
        disabled={!generated}
        className="mt-4 inline-flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-md border border-primary/60 text-primary hover:bg-primary/10 transition disabled:opacity-40"
      >
        <ArrowDown size={14} /> Test this password
      </button>
    </section>
  );
}
