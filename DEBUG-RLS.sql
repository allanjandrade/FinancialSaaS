-- Debug and Fix RLS Issues
-- This script will check current RLS status and apply fixes

-- Check current RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('families', 'family_members', 'finance_states', 'receipts', 'ai_conversations', 'ai_messages', 'ai_system_prompts', 'ai_audit_logs')
ORDER BY tablename;

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Force enable RLS on all tables
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable authenticated access" ON public.families;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.family_members;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.finance_states;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.receipts;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_conversations;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_messages;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_system_prompts;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_audit_logs;

-- Drop any other policies that might exist
DROP POLICY IF EXISTS "Users can view their own family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can insert their own family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can update their own family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can delete their own family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can view families they belong to" ON public.families;
DROP POLICY IF EXISTS "Users can insert families" ON public.families;
DROP POLICY IF EXISTS "Users can update families they belong to" ON public.families;
DROP POLICY IF EXISTS "Users can delete families they belong to" ON public.families;

-- Create very permissive debug policies - allow ALL authenticated users to do EVERYTHING
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

-- Verify the policies were created
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
  RAISE NOTICE 'RLS debug script completed';
  RAISE NOTICE 'All tables now have RLS enabled with permissive policies';
  RAISE NOTICE 'Authenticated users should have full access to all tables';
END $$;
