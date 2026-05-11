-- ================================================================
-- Wavebox Self-Learning AI Engine — Full Schema
-- Run this entire file in one go in the Supabase SQL Editor
-- ================================================================

-- ── 1. Conversation history ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question   text        NOT NULL,
  answer     text        NOT NULL,
  helpful    boolean,
  ai_model   text        DEFAULT 'self',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_helpful ON public.chatbot_conversations(helpful);
CREATE INDEX IF NOT EXISTS idx_cc_created ON public.chatbot_conversations(created_at DESC);

-- ── 2. Knowledge base ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_knowledge (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text        NOT NULL,
  answer        text        NOT NULL,
  helpful_count integer     NOT NULL DEFAULT 1,
  bad_count     integer     NOT NULL DEFAULT 0,
  term_vector   jsonb                DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_knowledge_question_unique UNIQUE (question)
);
CREATE INDEX IF NOT EXISTS idx_ck_helpful ON public.chatbot_knowledge(helpful_count DESC);

-- ── 3. N-gram model ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_ngrams (
  id      uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  context text    NOT NULL,
  next    text    NOT NULL,
  weight  integer NOT NULL DEFAULT 1,
  CONSTRAINT chatbot_ngrams_context_next_unique UNIQUE (context, next)
);
CREATE INDEX IF NOT EXISTS idx_ngram_context ON public.chatbot_ngrams(context);

-- ── 4. Intent classifier ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_intents (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  intent     text        NOT NULL,
  examples   text[]      NOT NULL DEFAULT '{}',
  response   text        NOT NULL,
  weight     float       NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chatbot_intents_intent_unique UNIQUE (intent)
);
CREATE INDEX IF NOT EXISTS idx_intent_name ON public.chatbot_intents(intent);

-- ── 5. updated_at trigger for knowledge ──────────────────────────
DO $$ BEGIN
  CREATE TRIGGER ck_updated_at
    BEFORE UPDATE ON public.chatbot_knowledge
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 6. Atomic n-gram upsert function ─────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_ngram(_context text, _next text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.chatbot_ngrams (context, next, weight)
  VALUES (_context, _next, 1)
  ON CONFLICT ON CONSTRAINT chatbot_ngrams_context_next_unique
  DO UPDATE SET weight = chatbot_ngrams.weight + 1;
END;
$$;

-- ── 7. RLS ───────────────────────────────────────────────────────
ALTER TABLE public.chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_knowledge     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_ngrams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_intents       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_conversations" ON public.chatbot_conversations;
DROP POLICY IF EXISTS "service_all_knowledge"     ON public.chatbot_knowledge;
DROP POLICY IF EXISTS "service_all_ngrams"        ON public.chatbot_ngrams;
DROP POLICY IF EXISTS "service_all_intents"       ON public.chatbot_intents;

CREATE POLICY "service_all_conversations" ON public.chatbot_conversations FOR ALL USING (true);
CREATE POLICY "service_all_knowledge"     ON public.chatbot_knowledge     FOR ALL USING (true);
CREATE POLICY "service_all_ngrams"        ON public.chatbot_ngrams        FOR ALL USING (true);
CREATE POLICY "service_all_intents"       ON public.chatbot_intents       FOR ALL USING (true);

-- ── 8. Seed intent knowledge base ────────────────────────────────
INSERT INTO public.chatbot_intents (intent, examples, response) VALUES

('greeting',
 ARRAY['hi','hello','hey','good morning','good evening','habari','mambo','sasa','hujambo','niaje','howdy','sup','yo'],
 'Hello! 👋 Welcome to Wavebox! I''m your AI assistant. I can help with radio & TV streaming, wallet & payments, account setup, and advertising. What would you like to know?'),

('deposit',
 ARRAY['deposit','add money','fund wallet','top up','add funds','weka pesa','how to pay','payment','recharge'],
 'To deposit funds go to Wallet → choose your method:'||chr(10)||chr(10)||'💎 Crypto USDT — supports TRON, Ethereum, BNB, Polygon, Solana. Min $10, 2% fee.'||chr(10)||chr(10)||'💳 Card (Visa/Mastercard) — via Paystack. Min $5, 4% fee.'||chr(10)||chr(10)||'Your balance is credited in USD after confirmation.'),

('withdraw',
 ARRAY['withdraw','cash out','send money','toa pesa','withdrawal','get money','payout','transfer out'],
 'To withdraw: go to Wallet → Withdraw → choose M-Pesa, Bank account, or Crypto USDT.'||chr(10)||chr(10)||'Min $1. A $1 platform fee + small transfer fee applies.'||chr(10)||chr(10)||'M-Pesa and bank transfers are sent via Paystack instantly. Crypto within 24 hours.'),

('balance',
 ARRAY['balance','wallet','how much','my money','check balance','account balance','salio'],
 'Your wallet balance is shown in USD on the Wallet page (/wallet) and Profile page (/profile). You can deposit using Crypto USDT or Card, and withdraw to M-Pesa, bank, or crypto.'),

('radio',
 ARRAY['radio','station','listen','stream','music','tune in','play radio','find station'],
 'To listen to radio: go to the home page → browse by Country or Category → tap any station to play! 🎵'||chr(10)||chr(10)||'We have thousands of stations from 200+ countries. Genres: News, Sports, Music, Talk, Jazz, Classical, Hip-Hop, Reggae, Country, Latin and more.'),

('tv',
 ARRAY['tv','television','watch','channel','iptv','live tv','stream tv','video'],
 'To watch live TV: tap the TV tab → browse by country or category → tap any channel! 📺'||chr(10)||chr(10)||'We have news, sports, entertainment channels worldwide. Kenyan channels include Citizen TV, NTV, KTN News, K24, KBC, TV47 and more.'),

('kenya',
 ARRAY['kenya','kenyan','nairobi','citizen tv','ntv','ktn','k24','kbc','kameme','ramogi','inooro'],
 '🇰🇪 For Kenya:'||chr(10)||chr(10)||'Radio → select Kenya from the country list.'||chr(10)||chr(10)||'TV → select Kenya for: Citizen TV, NTV Kenya, KTN News, KTN Home, K24, KBC, TV47, Kameme TV, Ramogi TV, Inooro TV, Switch TV.'),

('advertise',
 ARRAY['advertise','advertisement','ad','promotion','marketing','promote','sponsor','place ad'],
 'To advertise on Wavebox: go to /advertise → submit your ad (video URL, upload, or Monetag URL).'||chr(10)||chr(10)||'Each impression costs $0.50 deducted from your wallet. Ads go through admin review before going live.'||chr(10)||chr(10)||'Contact +254706499848 for bulk deals.'),

('sleep_timer',
 ARRAY['sleep','timer','auto stop','stop after','sleep timer','lala','usingizi'],
 'Use the Sleep Timer 🌙 (moon icon in the player) to auto-stop after 5, 10, 15, 30, 45, 60, or 90 minutes. Perfect for falling asleep to your favourite station!'),

('equalizer',
 ARRAY['equalizer','bass','treble','sound quality','audio','eq','sound','volume boost'],
 'Use the Equalizer 🎛️ (sliders icon in the player) to choose a preset: Normal, Bass+, Treble+, Vocal, or Flat. Enhances your listening experience!'),

('account',
 ARRAY['account','sign up','register','login','sign in','create account','password','email','akaunti'],
 'To create an account: go to /auth → enter your email and password → tap Create account.'||chr(10)||chr(10)||'Already have one? Tap Sign in.'||chr(10)||chr(10)||'Having an account gives you access to wallet, live chat, favorites and more.'),

('live_chat',
 ARRAY['chat','message','comment','live chat','talk','discuss','mazungumzo'],
 'Wavebox has Live Chat while listening! 💬 The chat panel appears in the player. You need to be signed in to chat. Connect with listeners worldwide in real time!'),

('share',
 ARRAY['share','send to friend','share station','tell friend','share link'],
 'Tap the Share button in the player to share what you''re listening to. On mobile it opens the native share sheet. On desktop it copies the link to your clipboard.'),

('contact',
 ARRAY['contact','support','help','phone','reach','call','email support','customer service'],
 'Contact Wavebox:'||chr(10)||'📞 +254706499848'||chr(10)||'🌐 wavebox.site'||chr(10)||chr(10)||'For advertising inquiries visit /advertise. We''re happy to help!'),

('about',
 ARRAY['what is wavebox','about wavebox','wavebox','who made','who built','tell me about'],
 'Wavebox (wavebox.site) is a free live radio & TV streaming platform. Listen to thousands of radio stations, watch live TV channels, chat with listeners, and use a wallet for premium features. Based in Kenya, serving listeners globally! 🌍'),

('crypto',
 ARRAY['crypto','bitcoin','usdt','tron','ethereum','bnb','polygon','solana','blockchain','cryptocurrency'],
 'We accept USDT crypto deposits via NowPayments. Supported networks:'||chr(10)||'• TRON TRC20'||chr(10)||'• Ethereum ERC20'||chr(10)||'• BNB Smart Chain BEP20'||chr(10)||'• Polygon'||chr(10)||'• Solana'||chr(10)||'• Arbitrum'||chr(10)||'• Optimism'||chr(10)||'• TON'||chr(10)||chr(10)||'Go to Wallet → Crypto tab → select network → get address → send exact amount.'),

('paystack',
 ARRAY['paystack','card','visa','mastercard','mpesa','m-pesa','bank transfer','card payment'],
 'We use Paystack for card payments and M-Pesa/bank withdrawals.'||chr(10)||chr(10)||'💳 Card deposit: Wallet → Pay with Card → enter amount → complete in Paystack checkout.'||chr(10)||chr(10)||'📱 M-Pesa withdrawal: Wallet → Withdraw → M-Pesa → enter phone number.'),

('fees',
 ARRAY['fee','charge','cost','how much','minimum','bei','gharama'],
 'Wavebox fees:'||chr(10)||'• Crypto deposit: 2% fee, min $10'||chr(10)||'• Card deposit: 4% fee, min $5'||chr(10)||'• Withdrawal: $1 platform fee + small transfer fee'||chr(10)||'• Ad impression: $0.50 each'||chr(10)||chr(10)||'No fees for listening to radio or watching TV — it''s free!'),

('thanks',
 ARRAY['thank you','thanks','asante','sawa','great','awesome','perfect','good','nice','excellent'],
 'You''re welcome! 😊 Enjoy Wavebox! If you need anything else, just ask.')

ON CONFLICT ON CONSTRAINT chatbot_intents_intent_unique DO UPDATE
  SET examples = EXCLUDED.examples,
      response = EXCLUDED.response;
