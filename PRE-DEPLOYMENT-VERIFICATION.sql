-- Pre-Deployment Verification Script
-- Run this in your PRODUCTION Supabase SQL Editor to verify all systems are ready
-- This script will check: AI tables, RLS policies, and schema consistency

-- ============================================
-- CHECK 1: Verify AI Tables Exist
-- ============================================
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('ai_conversations', 'ai_messages', 'ai_system_prompts', 'ai_audit_logs');
    
    IF table_count = 4 THEN
        RAISE NOTICE '✅ CHECK 1 PASSED: All 4 AI tables exist in production';
    ELSE
        RAISE NOTICE '❌ CHECK 1 FAILED: Missing AI tables (found %, expected 4)', table_count;
    END IF;
END $$;

-- ============================================
-- CHECK 2: Verify RLS is Enabled on AI Tables
-- ============================================
DO $$
DECLARE
    rls_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN ('ai_conversations', 'ai_messages', 'ai_system_prompts', 'ai_audit_logs')
    AND relrowsecurity = true;
    
    IF rls_count = 4 THEN
        RAISE NOTICE '✅ CHECK 2 PASSED: RLS is enabled on all AI tables';
    ELSE
        RAISE NOTICE '❌ CHECK 2 FAILED: RLS not enabled on all tables (enabled on %, expected 4)', rls_count;
    END IF;
END $$;

-- ============================================
-- CHECK 3: Verify RLS Policies Exist
-- ============================================
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    -- Check for essential policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('ai_conversations', 'ai_messages')
    AND policyname LIKE '%Users can%';
    
    IF policy_count >= 4 THEN
        RAISE NOTICE '✅ CHECK 3 PASSED: Essential RLS policies exist (found % policies)', policy_count;
    ELSE
        RAISE NOTICE '❌ CHECK 3 FAILED: Missing essential RLS policies (found %, expected at least 4)', policy_count;
    END IF;
END $$;

-- ============================================
-- CHECK 4: Verify System Prompts Exist
-- ============================================
DO $$
DECLARE
    prompt_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO prompt_count
    FROM public.ai_system_prompts
    WHERE is_active = true;
    
    IF prompt_count >= 3 THEN
        RAISE NOTICE '✅ CHECK 4 PASSED: Default system prompts exist (found % active prompts)', prompt_count;
    ELSE
        RAISE NOTICE '❌ CHECK 4 FAILED: Missing default system prompts (found %, expected at least 3)', prompt_count;
    END IF;
END $$;

-- ============================================
-- CHECK 5: Verify Indexes Exist for Performance
-- ============================================
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE tablename IN ('ai_conversations', 'ai_messages', 'ai_audit_logs')
    AND schemaname = 'public';
    
    IF index_count >= 6 THEN
        RAISE NOTICE '✅ CHECK 5 PASSED: Performance indexes exist (found % indexes)', index_count;
    ELSE
        RAISE NOTICE '⚠️  CHECK 5 WARNING: Some performance indexes missing (found %, expected at least 6)', index_count;
    END IF;
END $$;

-- ============================================
-- CHECK 6: Verify Core Tables Exist
-- ============================================
DO $$
DECLARE
    core_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO core_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('families', 'family_members', 'finance_states');
    
    IF core_count = 3 THEN
        RAISE NOTICE '✅ CHECK 6 PASSED: Core finance tables exist';
    ELSE
        RAISE NOTICE '❌ CHECK 6 FAILED: Missing core finance tables (found %, expected 3)', core_count;
    END IF;
END $$;

-- ============================================
-- CHECK 7: Test RLS Policy Effectiveness
-- ============================================
-- This test creates a temporary function to verify RLS is working
-- Note: This requires an authenticated session to test properly

DO $$
DECLARE
    has_test_user BOOLEAN;
BEGIN
    -- Check if we can create a test (this will fail if RLS blocks it)
    -- In a real scenario, you would test with actual user sessions
    RAISE NOTICE 'ℹ️  CHECK 7: RLS Policy Effectiveness - Manual verification required';
    RAISE NOTICE '   To test RLS manually:';
    RAISE NOTICE '   1. Create two test users in Auth';
    RAISE NOTICE '   2. Have User A create a conversation';
    RAISE NOTICE '   3. Have User B try to SELECT from ai_conversations';
    RAISE NOTICE '   4. User B should get 0 rows (RLS working)';
END $$;

-- ============================================
-- FINAL SUMMARY
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PRE-DEPLOYMENT VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Verify all checks show ✅ PASSED';
    RAISE NOTICE '2. Check Edge Functions in Supabase Dashboard';
    RAISE NOTICE '3. Confirm GEMINI_API_KEY is set in Edge Function secrets';
    RAISE NOTICE '4. Run smoke tests as documented in PRODUCTION-DEPLOYMENT-GUIDE.md';
    RAISE NOTICE '';
    RAISE NOTICE 'If all checks pass: 🚀 READY FOR DEPLOYMENT';
END $$;
