-- Habilitar Realtime em finance_states (sincronização instantânea entre dispositivos)

ALTER TABLE public.finance_states REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'finance_states'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_states;
    END IF;
  END IF;
END $$;
