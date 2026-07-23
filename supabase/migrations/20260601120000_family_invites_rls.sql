-- Fase 12: convites familiares + RLS para uso multi-dispositivo
-- Execute no SQL Editor do Supabase (ou via supabase db push)

-- Baseline idempotente: permite reconstruir o banco somente pelas migrations.
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  invite_code VARCHAR(10) UNIQUE NOT NULL
    DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  display_name TEXT,
  email TEXT,
  access_role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.finance_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE UNIQUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.finance_states(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  image_data TEXT NOT NULL,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_in_transaction BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Extensões em family_members
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS access_role TEXT DEFAULT 'member';

ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_role_check
  CHECK (role IN ('admin', 'member', 'viewer'));

ALTER TABLE public.family_members DROP CONSTRAINT IF EXISTS family_members_access_role_check;
ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_access_role_check
  CHECK (access_role IN ('administrator', 'member', 'viewer'));

-- Convites por e-mail / link / token
CREATE TABLE IF NOT EXISTS public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email TEXT,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente', 'Aceito', 'Recusado', 'Expirado')),
  method TEXT NOT NULL DEFAULT 'link' CHECK (method IN ('email', 'link', 'qrcode')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS family_invites_family_id_idx ON public.family_invites(family_id);
CREATE INDEX IF NOT EXISTS family_invites_token_idx ON public.family_invites(token);
CREATE INDEX IF NOT EXISTS family_invites_email_idx ON public.family_invites(lower(email));
CREATE INDEX IF NOT EXISTS family_invites_status_idx ON public.family_invites(status);

-- Helpers
CREATE OR REPLACE FUNCTION public.user_family_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_is_family_admin(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id
      AND user_id = auth.uid()
      AND (role = 'admin' OR access_role = 'administrator')
  );
$$;

-- Aceitar convite por token (link / QR)
CREATE OR REPLACE FUNCTION public.accept_family_invite(p_token UUID, p_display_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.family_invites%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_member public.family_members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_invite FROM public.family_invites
  WHERE token = p_token AND status = 'Pendente' AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  v_email := auth.jwt() ->> 'email';

  IF v_invite.email IS NOT NULL AND v_email IS NOT NULL
     AND lower(trim(v_invite.email)) <> lower(trim(v_email)) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, role, access_role, display_name, email)
  VALUES (
    v_invite.family_id,
    v_user_id,
    'member',
    'member',
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(COALESCE(v_email, 'membro'), '@', 1)),
    v_email
  )
  ON CONFLICT (family_id, user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email
  RETURNING * INTO v_member;

  UPDATE public.family_invites
  SET status = 'Aceito', accepted_at = NOW(), accepted_by = v_user_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'family_id', v_invite.family_id,
    'member_id', v_member.id,
    'role', v_member.role
  );
END;
$$;

-- Entrar pela família via invite_code (6 caracteres)
CREATE OR REPLACE FUNCTION public.join_family_by_invite_code(p_code TEXT, p_display_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family public.families%ROWTYPE;
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_member public.family_members%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_family FROM public.families
  WHERE upper(trim(invite_code)) = upper(trim(p_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de convite inválido';
  END IF;

  v_email := auth.jwt() ->> 'email';

  INSERT INTO public.family_members (family_id, user_id, role, access_role, display_name, email)
  VALUES (
    v_family.id,
    v_user_id,
    'member',
    'member',
    COALESCE(NULLIF(trim(p_display_name), ''), split_part(COALESCE(v_email, 'membro'), '@', 1)),
    v_email
  )
  ON CONFLICT (family_id, user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    email = EXCLUDED.email
  RETURNING * INTO v_member;

  RETURN jsonb_build_object(
    'family_id', v_family.id,
    'family_name', v_family.name,
    'invite_code', v_family.invite_code,
    'member_id', v_member.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_family_invite(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family_by_invite_code(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_family_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_family_admin(UUID) TO authenticated;

-- RLS family_invites
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_invites_select_admin" ON public.family_invites;
CREATE POLICY "family_invites_select_admin" ON public.family_invites
FOR SELECT USING (public.user_is_family_admin(family_id));

DROP POLICY IF EXISTS "family_invites_select_own_email" ON public.family_invites;
CREATE POLICY "family_invites_select_own_email" ON public.family_invites
FOR SELECT USING (
  email IS NOT NULL
  AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS "family_invites_insert_admin" ON public.family_invites;
CREATE POLICY "family_invites_insert_admin" ON public.family_invites
FOR INSERT WITH CHECK (
  public.user_is_family_admin(family_id) AND invited_by = auth.uid()
);

DROP POLICY IF EXISTS "family_invites_update_admin" ON public.family_invites;
CREATE POLICY "family_invites_update_admin" ON public.family_invites
FOR UPDATE USING (public.user_is_family_admin(family_id));

-- families: criar + ler família própria
DROP POLICY IF EXISTS "Enable authenticated access" ON public.families;
DROP POLICY IF EXISTS "families_insert_authenticated" ON public.families;
CREATE POLICY "families_insert_authenticated" ON public.families
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "families_select_member" ON public.families;
CREATE POLICY "families_select_member" ON public.families
FOR SELECT USING (id IN (SELECT public.user_family_ids()));

DROP POLICY IF EXISTS "families_update_admin" ON public.families;
CREATE POLICY "families_update_admin" ON public.families
FOR UPDATE USING (public.user_is_family_admin(id));

-- family_members
DROP POLICY IF EXISTS "Enable authenticated access" ON public.family_members;
DROP POLICY IF EXISTS "family_members_select_same_family" ON public.family_members;
CREATE POLICY "family_members_select_same_family" ON public.family_members
FOR SELECT USING (family_id IN (SELECT public.user_family_ids()));

DROP POLICY IF EXISTS "family_members_insert_self" ON public.family_members;
CREATE POLICY "family_members_insert_self" ON public.family_members
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "family_members_update_self_or_admin" ON public.family_members;
CREATE POLICY "family_members_update_self_or_admin" ON public.family_members
FOR UPDATE USING (
  user_id = auth.uid() OR public.user_is_family_admin(family_id)
);

DROP POLICY IF EXISTS "family_members_delete_admin" ON public.family_members;
CREATE POLICY "family_members_delete_admin" ON public.family_members
FOR DELETE USING (
  public.user_is_family_admin(family_id) AND user_id <> auth.uid()
);

-- finance_states: membros leem; admin e membros com role member podem upsert (dados compartilhados)
DROP POLICY IF EXISTS "Enable authenticated access" ON public.finance_states;
DROP POLICY IF EXISTS "finance_states_select_member" ON public.finance_states;
CREATE POLICY "finance_states_select_member" ON public.finance_states
FOR SELECT USING (family_id IN (SELECT public.user_family_ids()));

DROP POLICY IF EXISTS "finance_states_upsert_member" ON public.finance_states;
CREATE POLICY "finance_states_upsert_member" ON public.finance_states
FOR ALL USING (family_id IN (SELECT public.user_family_ids()))
WITH CHECK (family_id IN (SELECT public.user_family_ids()));

-- Leitura pública do invite_code para validar (somente colunas não sensíveis via RPC join)
-- Convite por código usa join_family_by_invite_code (security definer)
