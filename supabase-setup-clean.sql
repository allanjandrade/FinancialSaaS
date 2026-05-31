-- Versão simplificada para uso após reset do banco de dados
-- Execute este SQL APENAS após um reset limpo do banco

-- Criar tabela de famílias
CREATE TABLE public.families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  invite_code VARCHAR(10) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de membros da família
CREATE TABLE public.family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- Criar tabela para armazenar os estados financeiros
CREATE TABLE public.finance_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(family_id)
);

-- Criar tabela para armazenar comprovantes processados
CREATE TABLE public.receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.finance_states(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  image_data TEXT NOT NULL,
  extracted_data JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_in_transaction BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS TEMPORÁRIAS PARA DEBUG (Remover em produção)
-- Permitir acesso autenticado durante desenvolvimento
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

-- Políticas RLS
-- Policy para permitir que usuários leiam famílias a que pertencem
CREATE POLICY "Users can read families they belong to" ON public.families
FOR SELECT USING (
  id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
);

-- Policy para permitir que usuários leiam sua própria participação na família
CREATE POLICY "Users can read their family membership" ON public.family_members
FOR SELECT USING (user_id = auth.uid());

-- Policy para permitir que usuários insiram sua própria participação na família
CREATE POLICY "Users can insert their own family membership" ON public.family_members
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy para permitir que usuários atualizem sua própria participação na família
CREATE POLICY "Users can update their own family membership" ON public.family_members
FOR UPDATE USING (user_id = auth.uid());

-- Policy para permitir que usuários deletem sua própria participação na família
CREATE POLICY "Users can delete their own family membership" ON public.family_members
FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Family members can read family finance" ON public.finance_states
FOR SELECT USING (
  family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
);

CREATE POLICY "Family admins can update family finance" ON public.finance_states
FOR ALL USING (
  family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can read family receipts" ON public.receipts
FOR SELECT USING (
  family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert own receipts" ON public.receipts
FOR INSERT WITH CHECK (
  user_id = auth.uid() AND family_id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update own receipts" ON public.receipts
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own receipts" ON public.receipts
FOR DELETE USING (user_id = auth.uid());

-- Índices
CREATE INDEX finance_states_family_id_idx ON public.finance_states(family_id);
CREATE INDEX family_members_family_id_idx ON public.family_members(family_id);
CREATE INDEX family_members_user_id_idx ON public.family_members(user_id);
CREATE INDEX families_invite_code_idx ON public.families(invite_code);
CREATE INDEX receipts_family_id_idx ON public.receipts(family_id);
CREATE INDEX receipts_user_id_idx ON public.receipts(user_id);
CREATE INDEX receipts_entry_id_idx ON public.receipts(entry_id);
CREATE INDEX receipts_processed_at_idx ON public.receipts(processed_at);

-- Função para gerar código de convite
CREATE FUNCTION generate_invite_code() RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
BEGIN
  FOR i IN 1..20 LOOP
    code := '';
    FOR j IN 1..6 LOOP
      code := code || substring(chars, floor(random() * 36 + 1)::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.families WHERE invite_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
  RETURN upper(substring(md5(now()::text || random()::text), 1, 6));
END;
$$ LANGUAGE plpgsql;

-- Trigger para código de convite
CREATE FUNCTION set_invite_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_family_insert BEFORE INSERT ON public.families
FOR EACH ROW EXECUTE FUNCTION set_invite_code();

-- Tabelas para IA e conversas
CREATE TABLE public.ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  title VARCHAR(255),
  context VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.ai_system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  prompt TEXT NOT NULL,
  context VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.ai_audit_logs (
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

-- Habilitar RLS para novas tabelas
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para IA
CREATE POLICY "Users can read their own conversations" ON public.ai_conversations
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own conversations" ON public.ai_conversations
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own conversations" ON public.ai_conversations
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own conversations" ON public.ai_conversations
FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Users can read messages from their conversations" ON public.ai_messages
FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM public.ai_conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages to their conversations" ON public.ai_messages
FOR INSERT WITH CHECK (
  conversation_id IN (
    SELECT id FROM public.ai_conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can read active system prompts" ON public.ai_system_prompts
FOR SELECT USING (is_active = true);

CREATE POLICY "Users can read their own audit logs" ON public.ai_audit_logs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Family admins can read family audit logs" ON public.ai_audit_logs
FOR SELECT USING (
  family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Índices para tabelas de IA
CREATE INDEX ai_conversations_user_id_idx ON public.ai_conversations(user_id);
CREATE INDEX ai_conversations_family_id_idx ON public.ai_conversations(family_id);
CREATE INDEX ai_conversations_context_idx ON public.ai_conversations(context);
CREATE INDEX ai_conversations_created_at_idx ON public.ai_conversations(created_at DESC);

CREATE INDEX ai_messages_conversation_id_idx ON public.ai_messages(conversation_id);
CREATE INDEX ai_messages_role_idx ON public.ai_messages(role);
CREATE INDEX ai_messages_created_at_idx ON public.ai_messages(created_at DESC);

CREATE INDEX ai_system_prompts_context_idx ON public.ai_system_prompts(context);
CREATE INDEX ai_system_prompts_is_active_idx ON public.ai_system_prompts(is_active);

CREATE INDEX ai_audit_logs_user_id_idx ON public.ai_audit_logs(user_id);
CREATE INDEX ai_audit_logs_family_id_idx ON public.ai_audit_logs(family_id);
CREATE INDEX ai_audit_logs_action_idx ON public.ai_audit_logs(action);
CREATE INDEX ai_audit_logs_created_at_idx ON public.ai_audit_logs(created_at DESC);

-- Inserir prompts padrão do sistema
INSERT INTO public.ai_system_prompts (name, prompt, context) VALUES
(
  'finance_assistant',
  'Você é um assistente financeiro especializado em ajudar famílias a gerenciar suas finanças. Seu objetivo é fornecer insights práticos, sugerir economias, e ajudar a entender padrões de gastos. Seja sempre útil, conciso e use exemplos práticos quando possível.',
  'finance'
),
(
  'receipt_processor',
  'Você é um especialista em extrair informações de comprovantes fiscais. Analise a imagem fornecida e extraia: valor total, data, estabelecimento, categoria de gasto, e itens principais. Retorne apenas os dados estruturados em formato JSON.',
  'receipt'
),
(
  'general_assistant',
  'Você é um assistente útil e amigável. Responda às perguntas de forma clara e concisa. Se não souber a resposta, seja honesto sobre isso.',
  'general'
);

-- Função para atualizar timestamp de conversas
CREATE FUNCTION update_conversation_timestamp() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ai_conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ai_message_insert 
AFTER INSERT ON public.ai_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();