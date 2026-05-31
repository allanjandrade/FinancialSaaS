-- Script de limpeza e recriação do banco de dados
-- Execute este script se tiver problemas com conflitos de schema

-- PASSO 1: Limpeza de tabelas problemáticas (execute primeiro)
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.finance_states CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.families CASCADE;

-- Funções e triggers
DROP FUNCTION IF EXISTS generate_invite_code() CASCADE;
DROP FUNCTION IF EXISTS set_invite_code() CASCADE;

-- PASSO 2: Recriação das tabelas com estrutura correta

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

-- Habilitar RLS (Row Level Security) em todas as tabelas
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Criar políticas de forma condicional para evitar conflitos
DO $$ 
BEGIN
  -- Políticas RLS para families
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can read families they belong to' 
    AND schemaname = 'public' 
    AND tablename = 'families'
  ) THEN
    CREATE POLICY "Users can read families they belong to"
    ON public.families
    FOR SELECT
    USING (
      id IN (
        SELECT family_id 
        FROM public.family_members 
        WHERE user_id = auth.uid()
      )
    );
  END IF;

  -- Políticas RLS para family_members
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can read their family membership' 
    AND schemaname = 'public' 
    AND tablename = 'family_members'
  ) THEN
    CREATE POLICY "Users can read their family membership"
    ON public.family_members
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can insert their own family membership' 
    AND schemaname = 'public' 
    AND tablename = 'family_members'
  ) THEN
    CREATE POLICY "Users can insert their own family membership"
    ON public.family_members
    FOR INSERT
    WITH CHECK (user_id = auth.uid());
  END IF;

  -- Política RLS: usuários só podem acessar dados da sua família
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Family members can read family finance' 
    AND schemaname = 'public' 
    AND tablename = 'finance_states'
  ) THEN
    CREATE POLICY "Family members can read family finance"
    ON public.finance_states
    FOR SELECT
    USING (
      family_id IN (
        SELECT family_id 
        FROM public.family_members 
        WHERE user_id = auth.uid()
      )
    );
  END IF;

  -- Política RLS: apenas admins podem modificar dados da família
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Family admins can update family finance' 
    AND schemaname = 'public' 
    AND tablename = 'finance_states'
  ) THEN
    CREATE POLICY "Family admins can update family finance"
    ON public.finance_states
    FOR ALL
    USING (
      family_id IN (
        SELECT family_id 
        FROM public.family_members 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
    WITH CHECK (
      family_id IN (
        SELECT family_id 
        FROM public.family_members 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  END IF;

  -- Políticas RLS para receipts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can read family receipts' 
    AND schemaname = 'public' 
    AND tablename = 'receipts'
  ) THEN
    CREATE POLICY "Users can read family receipts"
    ON public.receipts
    FOR SELECT
    USING (
      family_id IN (
        SELECT family_id 
        FROM public.family_members 
        WHERE user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can insert own receipts' 
    AND schemaname = 'public' 
    AND tablename = 'receipts'
  ) THEN
    CREATE POLICY "Users can insert own receipts"
    ON public.receipts
    FOR INSERT
    WITH CHECK (
      user_id = auth.uid() AND
      family_id IN (
        SELECT family_id 
        FROM public.family_members 
        WHERE user_id = auth.uid()
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can update own receipts' 
    AND schemaname = 'public' 
    AND tablename = 'receipts'
  ) THEN
    CREATE POLICY "Users can update own receipts"
    ON public.receipts
    FOR UPDATE
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Users can delete own receipts' 
    AND schemaname = 'public' 
    AND tablename = 'receipts'
  ) THEN
    CREATE POLICY "Users can delete own receipts"
    ON public.receipts
    FOR DELETE
    USING (user_id = auth.uid());
  END IF;
END $$;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS finance_states_family_id_idx ON public.finance_states(family_id);
CREATE INDEX IF NOT EXISTS family_members_family_id_idx ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS family_members_user_id_idx ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS families_invite_code_idx ON public.families(invite_code);
CREATE INDEX IF NOT EXISTS receipts_family_id_idx ON public.receipts(family_id);
CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS receipts_entry_id_idx ON public.receipts(entry_id);
CREATE INDEX IF NOT EXISTS receipts_processed_at_idx ON public.receipts(processed_at);

-- Função para gerar código de convite único e amigável (6 caracteres alfanuméricos em caixa alta)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  max_attempts INTEGER := 20;
  random_char VARCHAR(1);
BEGIN
  FOR i IN 1..max_attempts LOOP
    code := '';
    
    -- Gerar 6 caracteres aleatórios
    FOR j IN 1..6 LOOP
      random_char := substring(chars, floor(random() * 36 + 1)::integer, 1);
      code := code || random_char;
    END LOOP;
    
    -- Verificar se o código já existe
    IF NOT EXISTS (SELECT 1 FROM public.families WHERE invite_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
  
  -- Fallback: usar timestamp + random se não conseguir código único
  RETURN upper(substring(md5(now()::text || random()::text), 1, 6));
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código de convite automaticamente
CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_family_insert
BEFORE INSERT ON public.families
FOR EACH ROW
EXECUTE FUNCTION set_invite_code();

-- Habilitar RLS (Row Level Security) em todas as tabelas
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem (para evitar conflitos em re-execuções)
DROP POLICY IF EXISTS "Users can read families they belong to" ON public.families;
DROP POLICY IF EXISTS "Users can read their family membership" ON public.family_members;
DROP POLICY IF EXISTS "Users can insert their own family membership" ON public.family_members;
DROP POLICY IF EXISTS "Family members can read family finance" ON public.finance_states;
DROP POLICY IF EXISTS "Family admins can update family finance" ON public.finance_states;
DROP POLICY IF EXISTS "Users can read family receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can insert own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can update own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can delete own receipts" ON public.receipts;

-- Políticas RLS para families
CREATE POLICY "Users can read families they belong to"
ON public.families
FOR SELECT
USING (
  id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para families
CREATE POLICY "Users can read families they belong to"
ON public.families
FOR SELECT
USING (
  id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid()
  )
);

-- Políticas RLS para family_members
CREATE POLICY "Users can read their family membership"
ON public.family_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own family membership"
ON public.family_members
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Política RLS: usuários só podem acessar dados da sua família
CREATE POLICY "Family members can read family finance"
ON public.finance_states
FOR SELECT
USING (
  family_id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid()
  )
);

-- Política RLS: apenas admins podem modificar dados da família
CREATE POLICY "Family admins can update family finance"
ON public.finance_states
FOR ALL
USING (
  family_id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  family_id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Políticas RLS para receipts
CREATE POLICY "Users can read family receipts"
ON public.receipts
FOR SELECT
USING (
  family_id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own receipts"
ON public.receipts
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  family_id IN (
    SELECT family_id 
    FROM public.family_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own receipts"
ON public.receipts
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own receipts"
ON public.receipts
FOR DELETE
USING (user_id = auth.uid());

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS finance_states_family_id_idx ON public.finance_states(family_id);
CREATE INDEX IF NOT EXISTS family_members_family_id_idx ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS family_members_user_id_idx ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS families_invite_code_idx ON public.families(invite_code);
CREATE INDEX IF NOT EXISTS receipts_family_id_idx ON public.receipts(family_id);
CREATE INDEX IF NOT EXISTS receipts_user_id_idx ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS receipts_entry_id_idx ON public.receipts(entry_id);
CREATE INDEX IF NOT EXISTS receipts_processed_at_idx ON public.receipts(processed_at);

-- Função para gerar código de convite único e amigável (6 caracteres alfanuméricos em caixa alta)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  code VARCHAR(6);
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  max_attempts INTEGER := 20;
  random_char VARCHAR(1);
BEGIN
  FOR i IN 1..max_attempts LOOP
    code := '';
    
    -- Gerar 6 caracteres aleatórios
    FOR j IN 1..6 LOOP
      random_char := substring(chars, floor(random() * 36 + 1)::integer, 1);
      code := code || random_char;
    END LOOP;
    
    -- Verificar se o código já existe
    IF NOT EXISTS (SELECT 1 FROM public.families WHERE invite_code = code) THEN
      RETURN code;
    END IF;
  END LOOP;
  
  -- Fallback: usar timestamp + random se não conseguir código único
  RETURN upper(substring(md5(now()::text || random()::text), 1, 6));
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código de convite automaticamente
CREATE OR REPLACE FUNCTION set_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_family_insert ON public.families;

CREATE TRIGGER on_family_insert
BEFORE INSERT ON public.families
FOR EACH ROW
EXECUTE FUNCTION set_invite_code();
