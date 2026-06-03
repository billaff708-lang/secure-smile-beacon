import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listVault = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [owned, shared] = await Promise.all([
      supabase.from("vault_items").select("*").eq("owner_id", userId).order("created_at", { ascending: false }),
      supabase
        .from("vault_items")
        .select("*, vault_shares!inner(shared_with)")
        .eq("vault_shares.shared_with", userId),
    ]);
    if (owned.error) throw new Error(owned.error.message);
    if (shared.error) throw new Error(shared.error.message);
    return { owned: owned.data ?? [], shared: shared.data ?? [] };
  });

export const addVaultItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().min(1).max(120),
      username: z.string().max(200).optional(),
      secret: z.string().min(1).max(2000),
      notes: z.string().max(2000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("vault_items").insert({
      owner_id: userId,
      title: data.title,
      username: data.username ?? null,
      secret: data.secret,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVaultItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("vault_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const shareVaultItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ item_id: z.string().uuid(), email: z.string().email() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up target user id by email via admin (auth schema is not exposed).
    const { data: users, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers();
    if (lookupErr) throw new Error(lookupErr.message);
    const target = users.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!target) throw new Error("No user with that email");
    const { error } = await supabase
      .from("vault_shares")
      .insert({ item_id: data.item_id, shared_with: target.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });