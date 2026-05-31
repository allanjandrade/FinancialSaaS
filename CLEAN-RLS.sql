-- Clean RLS Policies - Remove all old policies, keep only permissive ones
-- This will remove ALL policies except "Enable all access for authenticated users"

-- Drop ALL policies on families
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.families;
DROP POLICY IF EXISTS "Permitir leitura de famílias para usuários autenticados" ON public.families;
DROP POLICY IF EXISTS "Users can read families they belong to" ON public.families;
DROP POLICY IF EXISTS "Users can insert families" ON public.families;
DROP POLICY IF EXISTS "Users can update families they belong to" ON public.families;
DROP POLICY IF EXISTS "Users can delete families they belong to" ON public.families;

-- Drop ALL policies on family_members
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.family_members;
DROP POLICY IF EXISTS "Permitir leitura para o próprio usuário autenticado" ON public.family_members;
DROP POLICY IF EXISTS "Users can delete their own family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can insert their own family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can read their family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can update their own family membership" ON public.family_members;

-- Drop ALL policies on finance_states
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.finance_states;
DROP POLICY IF EXISTS "Family admins can update family finance" ON public.finance_states;
DROP POLICY IF EXISTS "Family members can read family finance" ON public.finance_states;

-- Drop ALL policies on receipts
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can insert own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can read family receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON public.receipts;

-- Drop ALL policies on ai_conversations
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can read their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;

-- Drop ALL policies on ai_messages
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can read messages from their conversations" ON public.ai_messages;

-- Drop ALL policies on ai_system_prompts
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.ai_system_prompts;
DROP POLICY IF EXISTS "All users can read active system prompts" ON public.ai_system_prompts;

-- Drop ALL policies on ai_audit_logs
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "Users can read their own audit logs" ON public.ai_audit_logs;

-- Now create ONLY the permissive policies
CREATE POLICY "Enable all access for authenticated users" ON public.families
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.family_members
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.finance_states
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.receipts
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.ai_conversations
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.ai_messages
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.ai_system_prompts
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.ai_audit_logs
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Verify only the permissive policies remain
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'All old RLS policies removed';
  RAISE NOTICE 'Only permissive "Enable all access for authenticated users" policies remain';
  RAISE NOTICE 'Authenticated users should now have full access to all tables';
END $$;
