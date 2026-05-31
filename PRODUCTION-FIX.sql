-- CRITICAL: Run this in Supabase SQL Editor to fix 403 errors before production deployment

-- Fix RLS policies for family_members
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can read their family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can insert their own family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can update their own family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can delete their own family membership" ON public.family_members;

-- Create RLS policies
CREATE POLICY "Users can read their family membership" ON public.family_members
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own family membership" ON public.family_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own family membership" ON public.family_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own family membership" ON public.family_members
FOR DELETE USING (user_id = auth.uid());

-- Verify RLS is enabled
SELECT 
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('family_members', 'families', 'finance_states', 'receipts', 'ai_conversations', 'ai_messages', 'ai_system_prompts', 'ai_audit_logs');
