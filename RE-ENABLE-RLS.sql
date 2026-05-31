-- Re-enable RLS after debugging
-- Run this after CHECK-RLS.sql to restore RLS

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- Recreate permissive policies
CREATE POLICY "Enable all access for authenticated users" ON public.family_members
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable all access for authenticated users" ON public.families
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'RLS re-enabled on family_members and families';
  RAISE NOTICE 'Permissive policies recreated';
END $$;
