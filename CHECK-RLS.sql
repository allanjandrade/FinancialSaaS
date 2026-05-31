-- Diagnostic Script - Check RLS Status
-- This will show us the current state of RLS and policies

-- Check if RLS is enabled on tables
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('families', 'family_members', 'finance_states', 'receipts', 'ai_conversations', 'ai_messages', 'ai_system_prompts', 'ai_audit_logs')
ORDER BY tablename;

-- Check all existing policies
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

-- Test if we can disable RLS temporarily to isolate the issue
-- This is for debugging only - will re-enable after
ALTER TABLE public.family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.families DISABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS temporarily disabled on family_members and families for debugging';
  RAISE NOTICE 'Try logging in now - if it works, the issue is definitely RLS policies';
  RAISE NOTICE 'After testing, run RE-ENABLE-RLS.sql to re-enable RLS';
END $$;
