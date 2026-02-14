DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'security_agent'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'security_agent';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_security_agent(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'security_agent')
$$;

DROP POLICY IF EXISTS "Security agents can insert crime events" ON public.crime_events;
CREATE POLICY "Security agents can insert crime events"
ON public.crime_events FOR INSERT
TO authenticated
WITH CHECK (public.is_security_agent(auth.uid()) OR public.is_analyst(auth.uid()) OR public.is_admin(auth.uid()));
