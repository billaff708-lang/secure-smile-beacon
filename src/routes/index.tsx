import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Shield, Eye, EyeOff, AlertTriangle, CheckCircle2, Terminal, Zap, Lock,
  Wand2, RefreshCw, Copy, Check, ArrowDown,
} from "lucide-react";
import { analyze } from "@/lib/password-analyzer";
import { generatePassword, type GenOptions } from "@/lib/password-generator";

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

  const copyPw = async () => {
    if (!pw) return;
    await navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-5xl">
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
          <span className="text-primary">●</span> Client-side cryptanalysis · No network calls
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
