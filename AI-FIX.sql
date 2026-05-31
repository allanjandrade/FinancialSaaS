-- AI Tables Setup - Run this in Supabase SQL Editor to enable AI features

-- Create AI conversations table
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  title VARCHAR(255),
  context VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI messages table
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI system prompts table
CREATE TABLE IF NOT EXISTS public.ai_system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  prompt TEXT NOT NULL,
  context VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI audit logs table
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10,4) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on AI tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for AI conversations
DROP POLICY IF EXISTS "Users can read their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.ai_conversations;

CREATE POLICY "Users can read their own conversations" ON public.ai_conversations
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own conversations" ON public.ai_conversations
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations" ON public.ai_conversations
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations" ON public.ai_conversations
FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for AI messages
DROP POLICY IF EXISTS "Users can read messages from their conversations" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can insert messages to their conversations" ON public.ai_messages;

CREATE POLICY "Users can read messages from their conversations" ON public.ai_messages
FOR SELECT USING (
  conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert messages to their conversations" ON public.ai_messages
FOR INSERT WITH CHECK (
  conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid())
);

-- RLS Policies for AI system prompts (read-only for all users)
DROP POLICY IF EXISTS "All users can read active system prompts" ON public.ai_system_prompts;

CREATE POLICY "All users can read active system prompts" ON public.ai_system_prompts
FOR SELECT USING (is_active = true);

-- RLS Policies for AI audit logs
DROP POLICY IF EXISTS "Users can read their own audit logs" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.ai_audit_logs;

CREATE POLICY "Users can read their own audit logs" ON public.ai_audit_logs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own audit logs" ON public.ai_audit_logs
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON public.ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_family_id_idx ON public.ai_conversations(family_id);
CREATE INDEX IF NOT EXISTS ai_conversations_updated_at_idx ON public.ai_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON public.ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_messages_created_at_idx ON public.ai_messages(created_at);
CREATE INDEX IF NOT EXISTS ai_system_prompts_context_idx ON public.ai_system_prompts(context);
CREATE INDEX IF NOT EXISTS ai_system_prompts_active_idx ON public.ai_system_prompts(is_active);
CREATE INDEX IF NOT EXISTS ai_audit_logs_user_id_idx ON public.ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS ai_audit_logs_family_id_idx ON public.ai_audit_logs(family_id);
CREATE INDEX IF NOT EXISTS ai_audit_logs_created_at_idx ON public.ai_audit_logs(created_at DESC);

-- Insert default system prompts
INSERT INTO public.ai_system_prompts (name, prompt, context, is_active) VALUES
(
  'finance_assistant',
  'You are an objective and professional financial analyst assistant. Your role is to help users understand their financial situation and provide actionable insights.',
  'finance',
  true
),
(
  'receipt_processor',
  'Analise este comprovante de pagamento. Extraia estritamente os dados em formato JSON válido.',
  'receipt',
  true
),
(
  'general_assistant',
  'You are a helpful assistant ready to help with any questions or tasks.',
  'general',
  true
)
ON CONFLICT (name) DO NOTHING;

-- Create trigger to update conversation timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_conversations_timestamp ON public.ai_conversations;
CREATE TRIGGER update_ai_conversations_timestamp
BEFORE UPDATE ON public.ai_conversations
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();
