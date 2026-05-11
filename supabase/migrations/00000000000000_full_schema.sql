-- =============================================================
-- WAVEBOX — Full Schema Migration
-- Run this in your Supabase SQL Editor (new project)
-- Project: uwbjvhrqqknukfzzzsii
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 2. CORE TABLES
-- ─────────────────────────────────────────────────────────────

-- Profiles (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- User roles (admin / user)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- House ads (admin-managed)
CREATE TABLE IF NOT EXISTS public.ads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL CHECK (kind IN ('video_file','video_url','monetag_url')),
  title      text NOT NULL,
  payload    text NOT NULL,
  sequence   integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ads_sequence_idx ON public.ads(sequence);

-- Marquee scrolling banners (admin-managed)
CREATE TABLE IF NOT EXISTS public.marquee_texts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text       text NOT NULL,
  position   text NOT NULL DEFAULT 'top' CHECK (position IN ('top','bottom')),
  sequence   integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_cents integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Wallet transaction ledger
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  amount_cents  integer NOT NULL,
  status        text NOT NULL DEFAULT 'completed',
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wt_user ON public.wallet_transactions(user_id);

-- Wallet payments (deposits & withdrawals)
CREATE TABLE IF NOT EXISTS public.wallet_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider          text NOT NULL,
  kind              text NOT NULL,
  external_id       text,
  status            text NOT NULL DEFAULT 'pending',
  amount_usd_cents  integer NOT NULL,
  fee_cents         integer NOT NULL DEFAULT 0,
  net_cents         integer NOT NULL DEFAULT 0,
  pay_currency      text,
  pay_network       text,
  pay_address       text,
  pay_amount        text,
  qr_code           text,
  expires_at        timestamptz,
  raw               jsonb,
  destination       jsonb,
  admin_note        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wp_user     ON public.wallet_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_wp_external ON public.wallet_payments(external_id);
CREATE INDEX IF NOT EXISTS idx_wp_status   ON public.wallet_payments(status);

-- Advertiser self-serve ads
CREATE TABLE IF NOT EXISTS public.advertiser_ads (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                     text NOT NULL,
  kind                      text NOT NULL CHECK (kind IN ('video_file','video_url','monetag_url')),
  payload                   text NOT NULL,
  daily_impressions         integer NOT NULL DEFAULT 10,
  cost_per_impression_cents integer NOT NULL DEFAULT 50,
  status                    text NOT NULL DEFAULT 'pending_review',
  rejection_reason          text,
  last_shown_at             timestamptz,
  total_impressions         integer NOT NULL DEFAULT 0,
  today_impressions         integer NOT NULL DEFAULT 0,
  today_date                date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adv_user   ON public.advertiser_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_adv_status ON public.advertiser_ads(status);

-- Ad impression tracking (daily counts per ad)
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id  uuid NOT NULL REFERENCES public.advertiser_ads(id) ON DELETE CASCADE,
  date   date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count  integer NOT NULL DEFAULT 0
);

-- Live chat comments per radio/TV channel
CREATE TABLE IF NOT EXISTS public.channel_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_kind text NOT NULL,
  channel_id   text NOT NULL,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_channel ON public.channel_comments(channel_kind, channel_id);

-- Anonymous + authenticated listener sessions
CREATE TABLE IF NOT EXISTS public.listener_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key   text NOT NULL UNIQUE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip            text,
  country       text,
  city          text,
  region        text,
  user_agent    text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  seconds_total integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ls_key     ON public.listener_sessions(session_key);
CREATE INDEX IF NOT EXISTS idx_ls_seen    ON public.listener_sessions(last_seen_at);

-- Per-device play history / favorites
CREATE TABLE IF NOT EXISTS public.station_plays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    text NOT NULL,
  station_id   text NOT NULL,
  station_name text NOT NULL,
  station_type text NOT NULL DEFAULT 'radio',
  play_count   integer NOT NULL DEFAULT 1,
  last_played  timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (device_id, station_id)
);
CREATE INDEX IF NOT EXISTS idx_station_plays_device  ON public.station_plays(device_id);
CREATE INDEX IF NOT EXISTS idx_station_plays_station ON public.station_plays(station_id);

-- Station thumbs-up / thumbs-down ratings
CREATE TABLE IF NOT EXISTS public.station_ratings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id   text NOT NULL,
  station_name text NOT NULL,
  vote         text NOT NULL CHECK (vote IN ('up','down')),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_station_ratings_id ON public.station_ratings(station_id);


-- ─────────────────────────────────────────────────────────────
-- 3. HELPER FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM public, anon, authenticated;

-- Attach updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER ads_set_updated_at          BEFORE UPDATE ON public.ads           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER profiles_set_updated_at     BEFORE UPDATE ON public.profiles      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER marquee_set_updated_at      BEFORE UPDATE ON public.marquee_texts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER wallets_set_updated_at      BEFORE UPDATE ON public.wallets       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER wp_updated                  BEFORE UPDATE ON public.wallet_payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER adv_ads_set_updated_at      BEFORE UPDATE ON public.advertiser_ads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- has_role (used inside RLS policies)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- adjust_wallet (atomic balance update)
CREATE OR REPLACE FUNCTION public.adjust_wallet(_user_id uuid, _delta_cents integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_bal integer;
BEGIN
  UPDATE public.wallets
    SET balance_cents = balance_cents + _delta_cents
    WHERE user_id = _user_id
    RETURNING balance_cents INTO new_bal;
  RETURN new_bal;
END;
$$;

-- Auto-create profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));

  -- sammyseth260@gmail.com is always admin
  IF lower(NEW.email) = 'sammyseth260@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
      ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

DO $$ BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- charge_advertiser_impression (atomic, returns new balance or NULL)
CREATE OR REPLACE FUNCTION public.charge_advertiser_impression(_ad_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ad_row    public.advertiser_ads%ROWTYPE;
  cost      int;
  new_bal   int;
  today     date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  SELECT * INTO ad_row FROM public.advertiser_ads
    WHERE id = _ad_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  cost := ad_row.cost_per_impression_cents;

  -- reset daily counter if new day
  IF ad_row.today_date <> today THEN
    UPDATE public.advertiser_ads SET today_date = today, today_impressions = 0 WHERE id = _ad_id;
    ad_row.today_impressions := 0;
  END IF;

  IF ad_row.today_impressions >= ad_row.daily_impressions THEN
    RETURN NULL; -- daily cap reached
  END IF;

  UPDATE public.wallets
    SET balance_cents = balance_cents - cost
    WHERE user_id = ad_row.user_id AND balance_cents >= cost
    RETURNING balance_cents INTO new_bal;

  IF new_bal IS NULL THEN RETURN NULL; END IF; -- insufficient funds

  INSERT INTO public.wallet_transactions(user_id, kind, amount_cents, status, note)
    VALUES (ad_row.user_id, 'ad_charge', -cost, 'completed', 'Ad impression: ' || ad_row.title);

  UPDATE public.advertiser_ads
    SET total_impressions = total_impressions + 1,
        today_impressions = today_impressions + 1,
        last_shown_at     = now()
    WHERE id = _ad_id;

  RETURN new_bal;
END;
$$;

-- admin_resolve_withdrawal
CREATE OR REPLACE FUNCTION public.admin_resolve_withdrawal(_payment_id uuid, _approve boolean, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.wallet_payments%ROWTYPE;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO p FROM public.wallet_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND OR p.kind <> 'withdrawal' OR p.status NOT IN ('pending') THEN
    RAISE EXCEPTION 'invalid payment';
  END IF;
  IF _approve THEN
    UPDATE public.wallet_payments SET status = 'approved', admin_note = _note WHERE id = _payment_id;
  ELSE
    PERFORM public.adjust_wallet(p.user_id, p.amount_usd_cents);
    INSERT INTO public.wallet_transactions(user_id, kind, amount_cents, note)
      VALUES (p.user_id, 'refund', p.amount_usd_cents, 'Withdrawal rejected');
    UPDATE public.wallet_payments SET status = 'rejected', admin_note = _note WHERE id = _payment_id;
  END IF;
END;
$$;

-- credit_deposit (called by edge functions via service role)
CREATE OR REPLACE FUNCTION public.credit_deposit(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.wallet_payments%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.wallet_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND OR p.kind <> 'deposit' OR p.status = 'finished' THEN RETURN; END IF;
  PERFORM public.adjust_wallet(p.user_id, p.net_cents);
  INSERT INTO public.wallet_transactions(user_id, kind, amount_cents, note)
    VALUES (p.user_id, 'deposit', p.net_cents, p.provider || ' deposit $' || (p.amount_usd_cents/100.0)::text);
  UPDATE public.wallet_payments SET status = 'finished' WHERE id = _payment_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marquee_texts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_ads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listener_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_plays     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_ratings   ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users view own roles"  ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles"   ON public.user_roles FOR ALL    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ads (house ads)
CREATE POLICY "Anyone view active ads" ON public.ads FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage ads"      ON public.ads FOR ALL    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- marquee_texts
CREATE POLICY "Anyone view active marquees" ON public.marquee_texts FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage marquees"      ON public.marquee_texts FOR ALL    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- wallets
CREATE POLICY "Users view own wallet"   ON public.wallets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service update wallet"   ON public.wallets FOR UPDATE USING (true);

-- wallet_transactions
CREATE POLICY "Users view own txs"   ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service insert txs"   ON public.wallet_transactions FOR INSERT WITH CHECK (true);

-- wallet_payments
CREATE POLICY "Users view own payments"   ON public.wallet_payments FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own payments" ON public.wallet_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update payments"    ON public.wallet_payments FOR UPDATE USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can update payments" ON public.wallet_payments FOR UPDATE TO anon, authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- advertiser_ads
CREATE POLICY "Users view own ads"       ON public.advertiser_ads FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone view approved ads" ON public.advertiser_ads FOR SELECT USING (status = 'approved');
CREATE POLICY "Users insert own ads"     ON public.advertiser_ads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ads"     ON public.advertiser_ads FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage adv ads"    ON public.advertiser_ads FOR ALL    USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service update adv ads"   ON public.advertiser_ads FOR UPDATE USING (true);

-- ad_impressions
CREATE POLICY "Admins view impressions" ON public.ad_impressions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service insert impressions" ON public.ad_impressions FOR INSERT WITH CHECK (true);

-- channel_comments
CREATE POLICY "Anyone view comments"    ON public.channel_comments FOR SELECT USING (true);
CREATE POLICY "Auth users post comments" ON public.channel_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.channel_comments FOR DELETE USING (auth.uid() = user_id);

-- listener_sessions
CREATE POLICY "Anon upsert sessions"    ON public.listener_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update sessions"    ON public.listener_sessions FOR UPDATE USING (true);
CREATE POLICY "Admins view sessions"    ON public.listener_sessions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- station_plays
CREATE POLICY "Anyone read station plays"   ON public.station_plays FOR SELECT USING (true);
CREATE POLICY "Anyone upsert station plays" ON public.station_plays FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone update station plays" ON public.station_plays FOR UPDATE USING (true);

-- station_ratings
CREATE POLICY "Anyone view ratings"   ON public.station_ratings FOR SELECT USING (true);
CREATE POLICY "Anyone insert ratings" ON public.station_ratings FOR INSERT WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- 5. STORAGE BUCKET (ads videos)
-- ─────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
  VALUES ('ads', 'ads', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read ads files" ON storage.objects FOR SELECT USING (bucket_id = 'ads');
CREATE POLICY "Admins upload ads"     ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ads' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update ads"     ON storage.objects FOR UPDATE USING  (bucket_id = 'ads' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete ads"     ON storage.objects FOR DELETE USING  (bucket_id = 'ads' AND public.has_role(auth.uid(), 'admin'));
-- Also allow advertisers to upload their own ad files
CREATE POLICY "Advertisers upload ads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ads' AND auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────
-- 6. REALTIME (enable for live chat)
-- ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_comments;


-- ─────────────────────────────────────────────────────────────
-- 7. GRANT admin role to owner email (if already signed up)
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'admin'::public.app_role
  FROM auth.users
  WHERE lower(email) = 'sammyseth260@gmail.com'
  ON CONFLICT (user_id, role) DO NOTHING;
