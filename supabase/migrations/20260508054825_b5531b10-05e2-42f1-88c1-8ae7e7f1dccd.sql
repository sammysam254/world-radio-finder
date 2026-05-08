
-- Real payments table
CREATE TABLE public.wallet_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL, -- 'nowpayments' | 'paystack'
  kind text NOT NULL, -- 'deposit' | 'withdrawal'
  external_id text,
  status text NOT NULL DEFAULT 'pending', -- pending | waiting | confirming | confirmed | finished | failed | expired | approved | rejected
  amount_usd_cents integer NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL DEFAULT 0,
  pay_currency text,
  pay_network text,
  pay_address text,
  pay_amount text,
  qr_code text,
  expires_at timestamptz,
  raw jsonb,
  destination jsonb,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments" ON public.wallet_payments
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own payments" ON public.wallet_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update payments" ON public.wallet_payments
  FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Service can update payments" ON public.wallet_payments
  FOR UPDATE TO anon, authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER wp_updated BEFORE UPDATE ON public.wallet_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_wp_user ON public.wallet_payments(user_id);
CREATE INDEX idx_wp_external ON public.wallet_payments(external_id);
CREATE INDEX idx_wp_status ON public.wallet_payments(status);

-- Advertiser ad rotation tracking
ALTER TABLE public.advertiser_ads
  ADD COLUMN IF NOT EXISTS last_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS today_impressions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS today_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date;

-- Charge wallet for an advertiser impression atomically.
-- Returns new balance (or NULL if insufficient or capped).
CREATE OR REPLACE FUNCTION public.charge_advertiser_impression(_ad_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ad_row public.advertiser_ads%ROWTYPE;
  cost int;
  new_balance int;
  today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  SELECT * INTO ad_row FROM public.advertiser_ads WHERE id = _ad_id AND status = 'approved' FOR UPDATE;
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

  UPDATE public.wallets SET balance_cents = balance_cents - cost
    WHERE user_id = ad_row.user_id AND balance_cents >= cost
    RETURNING balance_cents INTO new_balance;

  IF new_balance IS NULL THEN
    RETURN NULL; -- insufficient funds
  END IF;

  INSERT INTO public.wallet_transactions(user_id, kind, amount_cents, status, note)
    VALUES (ad_row.user_id, 'ad_charge', -cost, 'completed', 'Ad impression: ' || ad_row.title);

  UPDATE public.advertiser_ads
    SET total_impressions = total_impressions + 1,
        today_impressions = today_impressions + 1,
        last_shown_at = now()
    WHERE id = _ad_id;

  RETURN new_balance;
END;
$$;

-- Admin approve/reject withdrawal: when approving, leave balance as is (already debited at request time);
-- when rejecting, refund the user.
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
    -- refund
    PERFORM public.adjust_wallet(p.user_id, p.amount_usd_cents);
    INSERT INTO public.wallet_transactions(user_id, kind, amount_cents, note)
      VALUES (p.user_id, 'refund', p.amount_usd_cents, 'Withdrawal rejected');
    UPDATE public.wallet_payments SET status = 'rejected', admin_note = _note WHERE id = _payment_id;
  END IF;
END;
$$;

-- Admin credit deposit (used by edge function via service role, or admin manually)
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
    VALUES (p.user_id, 'deposit', p.net_cents, p.provider || ' deposit ' || (p.amount_usd_cents/100.0)::text);
  UPDATE public.wallet_payments SET status = 'finished' WHERE id = _payment_id;
END;
$$;
