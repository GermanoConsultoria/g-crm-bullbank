-- Se ainda sobrar owner_id nulo em public.funnels (nenhum admin cadastrado
-- no momento em que a migration 20260928130000_funnel_ownership.sql rodou),
-- falha aqui com uma mensagem clara em vez de deixar o ALTER COLUMN daquela
-- migration quebrar com um erro genérico de NOT NULL.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.funnels WHERE owner_id IS NULL) THEN
    RAISE EXCEPTION 'Não há nenhum admin em public.user_roles para virar dono dos funis existentes. Cadastre um admin (role ''admin'') antes de rodar esta migration, ou atribua owner_id manualmente.';
  END IF;
END $$;
