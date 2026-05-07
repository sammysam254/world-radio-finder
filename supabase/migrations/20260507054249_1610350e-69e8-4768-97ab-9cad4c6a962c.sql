
CREATE TABLE public.channel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_kind text NOT NULL,        -- 'radio' | 'tv'
  channel_id text NOT NULL,          -- stationuuid or tv channel id
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone read comments" ON public.channel_comments
  FOR SELECT USING (true);

CREATE POLICY "Auth users insert own comments" ON public.channel_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own comments" ON public.channel_comments
  FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE INDEX idx_channel_comments_lookup
  ON public.channel_comments (channel_kind, channel_id, created_at DESC);

ALTER TABLE public.channel_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_comments;
