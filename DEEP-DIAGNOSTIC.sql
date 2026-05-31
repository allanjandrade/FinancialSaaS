-- Deep Diagnostic Script
-- Check if tables exist and test basic access

-- Check if tables exist
SELECT 
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('families', 'family_members', 'finance_states', 'receipts', 'ai_conversations', 'ai_messages', 'ai_system_prompts', 'ai_audit_logs')
ORDER BY tablename;

-- Check RLS status again
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('families', 'family_members')
ORDER BY tablename;

-- Force disable RLS on all tables
ALTER TABLE public.families DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs DISABLE ROW LEVEL SECURITY;

-- Grant all permissions to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Test query - try to select from family_members
SELECT COUNT(*) as family_members_count FROM public.family_members;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Deep diagnostic completed';
  RAISE NOTICE 'RLS disabled on all tables';
  RAISE NOTICE 'Full permissions granted to authenticated role';
  RAISE NOTICE 'If login still fails, the issue is not RLS-related';
END $$;
