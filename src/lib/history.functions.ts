import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("password_history")
      .select("id,label,entropy,score,length,breached,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

// Client sends SHA-256 hash only — raw password never leaves browser.
export const checkReuse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ hash: z.string().length(64).regex(/^[a-f0-9]+$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("password_history")
      .select("id,label,created_at")
      .eq("user_id", userId)
      .eq("hash", data.hash)
      .limit(1);
    if (error) throw new Error(error.message);
    return { reused: (rows?.length ?? 0) > 0, match: rows?.[0] ?? null };
  });

export const savePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      hash: z.string().length(64).regex(/^[a-f0-9]+$/),
      label: z.string().max(120).optional(),
      entropy: z.number().min(0).max(10000),
      score: z.number().int().min(0).max(4),
      length: z.number().int().min(0).max(1024),
      breached: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("password_history").insert({
      user_id: userId,
      hash: data.hash,
      label: data.label ?? null,
      entropy: data.entropy,
      score: data.score,
      length: data.length,
      breached: data.breached,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHistoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("password_history").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });