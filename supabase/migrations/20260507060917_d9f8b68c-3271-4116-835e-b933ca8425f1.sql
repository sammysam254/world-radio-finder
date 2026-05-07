
DROP POLICY IF EXISTS "Anyone insert session" ON public.listener_sessions;
DROP POLICY IF EXISTS "Anyone update own session" ON public.listener_sessions;

CREATE POLICY "Anyone insert session"
  ON public.listener_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone update own session"
  ON public.listener_sessions FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

GRANT INSERT, UPDATE, SELECT ON public.listener_sessions TO anon, authenticated;
