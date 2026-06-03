import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Shield, KeyRound, History, Plus, Trash2, Eye, EyeOff, UserPlus, AlertTriangle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listHistory, deleteHistoryItem } from "@/lib/history.functions";
import { listVault, addVaultItem, deleteVaultItem, shareVaultItem } from "@/lib/vault.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Password Analyzer" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition">
            <Shield className="text-primary" size={24} />
            <span className="font-mono font-bold">Password Analyzer</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1">
              <ArrowLeft size={12} /> Analyzer
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs font-mono px-3 py-1.5 rounded border border-border hover:border-destructive hover:text-destructive transition"
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <HistoryPanel />
          <VaultPanel />
        </div>
      </div>
    </main>
  );
}

function HistoryPanel() {
  const fn = useServerFn(listHistory);
  const delFn = useServerFn(deleteHistoryItem);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["history"], queryFn: () => fn() });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["history"] }),
  });

  return (
    <section className="rounded-lg border border-border bg-card/60 backdrop-blur p-5">
      <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
        <History size={14} className="text-primary" /> Password History
      </h2>
      <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1.5">
        <AlertTriangle size={11} /> Only hashes stored. The analyzer warns you if you reuse one.
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No history yet. Analyze a password and save it.</p>
      )}
      <ul className="space-y-2">
        {data?.items.map((it) => (
          <li key={it.id} className="flex items-center justify-between text-sm border border-border/60 rounded px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="font-mono truncate">{it.label || "(unlabeled)"}</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {new Date(it.created_at).toLocaleDateString()} · {it.length}c · {Number(it.entropy).toFixed(0)} bits · score {it.score}/4
                {it.breached && <span className="ml-2 text-destructive">BREACHED</span>}
              </div>
            </div>
            <button
              onClick={() => del.mutate(it.id)}
              className="text-muted-foreground hover:text-destructive p-1.5 transition"
              aria-label="Delete"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function VaultPanel() {
  const list = useServerFn(listVault);
  const add = useServerFn(addVaultItem);
  const del = useServerFn(deleteVaultItem);
  const share = useServerFn(shareVaultItem);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vault"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", username: "", secret: "", notes: "" });
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const addM = useMutation({
    mutationFn: () => add({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault"] });
      setForm({ title: "", username: "", secret: "", notes: "" });
      setOpen(false);
      toast.success("Saved to vault");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vault"] }),
  });
  const shareM = useMutation({
    mutationFn: (vars: { item_id: string; email: string }) => share({ data: vars }),
    onSuccess: () => toast.success("Shared"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border border-border bg-card/60 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <KeyRound size={14} className="text-primary" /> Shared Vault
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-mono px-2 py-1 rounded border border-primary/60 text-primary hover:bg-primary/10 inline-flex items-center gap-1"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); addM.mutate(); }}
          className="mb-4 space-y-2 border border-border/60 rounded p-3"
        >
          <input required placeholder="Title (e.g. GitHub)" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-input/60 border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          <input placeholder="Username / email" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full bg-input/60 border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          <input required placeholder="Password / secret" value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })}
            className="w-full bg-input/60 border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          <textarea placeholder="Notes" value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full bg-input/60 border border-border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          <button type="submit" disabled={addM.isPending}
            className="w-full py-1.5 rounded bg-primary text-primary-foreground text-xs font-mono uppercase tracking-widest disabled:opacity-50">
            {addM.isPending ? "…" : "Save"}
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && data.owned.length + data.shared.length === 0 && (
        <p className="text-sm text-muted-foreground">Vault is empty.</p>
      )}

      <ul className="space-y-2">
        {data?.owned.map((it) => (
          <VaultRow key={it.id} item={it} owned reveal={!!reveal[it.id]}
            onToggle={() => setReveal((r) => ({ ...r, [it.id]: !r[it.id] }))}
            onDelete={() => delM.mutate(it.id)}
            onShare={(email) => shareM.mutate({ item_id: it.id, email })} />
        ))}
        {data?.shared.map((it) => (
          <VaultRow key={`s-${it.id}`} item={it} owned={false} reveal={!!reveal[it.id]}
            onToggle={() => setReveal((r) => ({ ...r, [it.id]: !r[it.id] }))} />
        ))}
      </ul>
    </section>
  );
}

type VaultItem = { id: string; title: string; username: string | null; secret: string; notes: string | null };

function VaultRow({
  item, owned, reveal, onToggle, onDelete, onShare,
}: {
  item: VaultItem; owned: boolean; reveal: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onShare?: (email: string) => void;
}) {
  const [shareEmail, setShareEmail] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  return (
    <li className="border border-border/60 rounded px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono truncate">
            {item.title} {!owned && <span className="text-[10px] text-cyan ml-1">(shared)</span>}
          </div>
          {item.username && <div className="text-[10px] text-muted-foreground font-mono truncate">{item.username}</div>}
          <div className="font-mono text-xs mt-1 break-all text-foreground/90">
            {reveal ? item.secret : "•".repeat(Math.min(item.secret.length, 16))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={onToggle} className="text-muted-foreground hover:text-primary p-1" aria-label="Reveal">
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {owned && (
            <>
              <button onClick={() => setShareOpen((v) => !v)} className="text-muted-foreground hover:text-primary p-1" aria-label="Share">
                <UserPlus size={14} />
              </button>
              <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1" aria-label="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      {shareOpen && owned && (
        <div className="mt-2 flex gap-2">
          <input type="email" placeholder="user@example.com" value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            className="flex-1 bg-input/60 border border-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary" />
          <button
            onClick={() => { if (shareEmail) { onShare?.(shareEmail); setShareEmail(""); setShareOpen(false); } }}
            className="text-xs px-2 py-1 rounded border border-primary/60 text-primary hover:bg-primary/10"
          >
            Share
          </button>
        </div>
      )}
    </li>
  );
}