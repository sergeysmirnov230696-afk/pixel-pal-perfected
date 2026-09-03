CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_key text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'ru',
  balance numeric NOT NULL DEFAULT 0,
  collected numeric NOT NULL DEFAULT 0,
  referral_balance numeric NOT NULL DEFAULT 0,
  total_deposited numeric NOT NULL DEFAULT 0,
  referred_by text,
  addresses jsonb NOT NULL DEFAULT '{}'::jsonb,
  banned boolean NOT NULL DEFAULT false,
  boost_multiplier numeric NOT NULL DEFAULT 1,
  boost_until timestamptz,
  daily_streak integer NOT NULL DEFAULT 0,
  last_daily_at timestamptz,
  last_accrual timestamptz NOT NULL DEFAULT now(),
  first_dragon_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.player_dragons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  dragon_id integer NOT NULL,
  bought_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_dragons_player_id_idx ON public.player_dragons(player_id);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  kind text NOT NULL,
  method text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  address text,
  txid text,
  invoice_id text,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_player_id_idx ON public.transactions(player_id);
CREATE INDEX transactions_invoice_id_idx ON public.transactions(invoice_id);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  invited_key text,
  invited_name text NOT NULL,
  deposit numeric NOT NULL DEFAULT 0,
  income numeric NOT NULL DEFAULT 0,
  bonus_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_inviter_id_idx ON public.referrals(inviter_id);

CREATE TABLE public.player_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  key text NOT NULL,
  reward numeric NOT NULL DEFAULT 0,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, key)
);

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  code text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, code)
);

CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.game_settings (
  id boolean PRIMARY KEY DEFAULT true,
  min_deposit numeric NOT NULL DEFAULT 10,
  min_withdraw numeric NOT NULL DEFAULT 10,
  min_collect numeric NOT NULL DEFAULT 1,
  referral_percent numeric NOT NULL DEFAULT 10,
  referral_bonus numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_settings_singleton CHECK (id)
);

INSERT INTO public.game_settings (id) VALUES (true);

GRANT ALL ON public.players, public.player_dragons, public.transactions, public.referrals, public.game_settings, public.player_achievements, public.promo_codes, public.promo_redemptions, public.news TO service_role;
REVOKE ALL ON public.players, public.player_dragons, public.transactions, public.referrals, public.game_settings, public.player_achievements, public.promo_codes, public.promo_redemptions, public.news FROM anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['players','player_dragons','transactions','referrals','game_settings','player_achievements','promo_codes','promo_redemptions','news']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "no_direct_client_access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;