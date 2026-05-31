-- RLS Policies Only - For Existing Tables
-- Run this script if tables already exist but RLS policies need to be applied
-- This will NOT recreate tables, only enable RLS and create policies

-- Enable RLS on existing tables
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable authenticated access" ON public.families;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.family_members;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.finance_states;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.receipts;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_conversations;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_messages;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_system_prompts;
DROP POLICY IF EXISTS "Enable authenticated access" ON public.ai_audit_logs;

-- Create debug policies for development (allow authenticated access)
CREATE POLICY "Enable authenticated access" ON public.families
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.family_members
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.finance_states
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.receipts
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.ai_conversations
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.ai_messages
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.ai_system_prompts
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable authenticated access" ON public.ai_audit_logs
FOR ALL USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies applied successfully to all tables';
  RAISE NOTICE 'Debug policies enabled: authenticated users have full access';
  RAISE NOTICE 'WARNING: These are debug policies. Replace with restrictive policies for production.';
END $$;
