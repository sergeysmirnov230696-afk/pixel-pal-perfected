DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['players','player_dragons','transactions','referrals','game_settings','player_achievements','promo_codes','promo_redemptions','news']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "no_direct_client_access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "no_direct_client_access" ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', t);
  END LOOP;
END $$;