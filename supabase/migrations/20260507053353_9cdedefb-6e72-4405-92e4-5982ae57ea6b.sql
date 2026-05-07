
-- Marquee texts (admin editable)
CREATE TABLE public.marquee_texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  position text NOT NULL DEFAULT 'top', -- 'top' or 'bottom'
  active boolean NOT NULL DEFAULT true,
  sequence integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.marquee_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view active marquees" ON public.marquee_texts FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage marquees" ON public.marquee_texts FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Listener sessions
CREATE TABLE public.listener_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL UNIQUE,
  user_id uuid,
  ip text,
  country text,
  city text,
  region text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  seconds_total integer NOT NULL DEFAULT 0
);
ALTER TABLE public.listener_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone insert session" ON public.listener_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update own session" ON public.listener_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Admins view sessions" ON public.listener_sessions FOR SELECT USING (has_role(auth.uid(),'admin'));
CREATE INDEX idx_listener_sessions_last_seen ON public.listener_sessions(last_seen_at DESC);

-- Wallets
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL, -- deposit | withdrawal | ad_spend | fee
  amount_cents integer NOT NULL, -- signed
  status text NOT NULL DEFAULT 'completed', -- completed | pending
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own tx" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own tx" ON public.wallet_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update tx" ON public.wallet_transactions FOR UPDATE USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Advertiser ads (user-submitted)
CREATE TABLE public.advertiser_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  kind text NOT NULL, -- video_url | video_file | monetag_url
  payload text NOT NULL,
  daily_impressions integer NOT NULL DEFAULT 10,
  cost_per_impression_cents integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'pending_review', -- pending_review | approved | rejected | paused
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.advertiser_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ads" ON public.advertiser_ads FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Public view approved" ON public.advertiser_ads FOR SELECT USING (status = 'approved');
CREATE POLICY "Users insert own ads" ON public.advertiser_ads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ads" ON public.advertiser_ads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage ads" ON public.advertiser_ads FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Per-day impressions tally
CREATE TABLE public.ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES public.advertiser_ads(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  UNIQUE(ad_id, date)
);
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view impressions" ON public.ad_impressions FOR SELECT USING (true);
CREATE POLICY "Anyone insert impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update impressions" ON public.ad_impressions FOR UPDATE USING (true) WITH CHECK (true);

-- updated_at triggers
CREATE TRIGGER trg_marquee_updated BEFORE UPDATE ON public.marquee_texts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wallet_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_advertiser_ads_updated BEFORE UPDATE ON public.advertiser_ads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default marquees from existing UI text
INSERT INTO public.marquee_texts (text, position, sequence) VALUES
  ('📢 Contact +254706499848 to advertise here · Reach thousands of radio & TV listeners worldwide · Affordable packages available · Boost your brand on Wavebox', 'top', 1),
  ('This system is developed and is the property of Sam. Please call 0706499848 for Softwares, AI Tools, Websites, SEO Optimization, Mobile Apps and any other custom tool', 'bottom', 1);

-- Wallet helper RPC: atomic credit/debit
CREATE OR REPLACE FUNCTION public.adjust_wallet(_user_id uuid, _delta_cents integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  INSERT INTO public.wallets(user_id, balance_cents) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance_cents = balance_cents + _delta_cents
    WHERE user_id = _user_id
    RETURNING balance_cents INTO new_balance;
  RETURN new_balance;
END;
$$;
