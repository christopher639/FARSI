-- Add policy to allow users to read their own role
-- This prevents the chicken-and-egg problem where users can't read their role
-- because the RLS policy requires them to have a role first
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());