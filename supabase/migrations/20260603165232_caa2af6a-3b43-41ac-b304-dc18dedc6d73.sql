
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile write" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PASSWORD HISTORY (hashes only)
CREATE TABLE public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  hash TEXT NOT NULL,
  entropy NUMERIC NOT NULL DEFAULT 0,
  score SMALLINT NOT NULL DEFAULT 0,
  length SMALLINT NOT NULL DEFAULT 0,
  breached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX password_history_user_hash_idx ON public.password_history(user_id, hash);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_history TO authenticated;
GRANT ALL ON public.password_history TO service_role;
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own history" ON public.password_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- VAULT ITEMS
CREATE TABLE public.vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  username TEXT,
  secret TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_items TO authenticated;
GRANT ALL ON public.vault_items TO service_role;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

-- VAULT SHARES
CREATE TABLE public.vault_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.vault_items(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, shared_with)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_shares TO authenticated;
GRANT ALL ON public.vault_shares TO service_role;
ALTER TABLE public.vault_shares ENABLE ROW LEVEL SECURITY;

-- Vault policies (define after both tables exist for cross-reference)
CREATE POLICY "owner read vault" ON public.vault_items FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR EXISTS (
    SELECT 1 FROM public.vault_shares s WHERE s.item_id = vault_items.id AND s.shared_with = auth.uid()
  ));
CREATE POLICY "owner insert vault" ON public.vault_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update vault" ON public.vault_items FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "owner delete vault" ON public.vault_items FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "view own shares" ON public.vault_shares FOR SELECT TO authenticated
  USING (auth.uid() = shared_with OR EXISTS (
    SELECT 1 FROM public.vault_items i WHERE i.id = item_id AND i.owner_id = auth.uid()
  ));
CREATE POLICY "owner creates share" ON public.vault_shares FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vault_items i WHERE i.id = item_id AND i.owner_id = auth.uid()));
CREATE POLICY "owner deletes share" ON public.vault_shares FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vault_items i WHERE i.id = item_id AND i.owner_id = auth.uid()));

-- updated_at trigger for vault_items
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER vault_items_touch BEFORE UPDATE ON public.vault_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
