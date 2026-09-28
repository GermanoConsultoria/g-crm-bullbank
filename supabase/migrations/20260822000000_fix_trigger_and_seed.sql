-- Trigger: auto-criar profile + role ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'vendedor'::public.app_role END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed: estágios padrão (só insere se vazio)
INSERT INTO public.stages (name, position, color)
SELECT * FROM (VALUES
  ('Novo lead',         1, 'blue'),
  ('Contato feito',     2, 'blue'),
  ('Proposta enviada',  3, 'blue'),
  ('Negociação',        4, 'blue'),
  ('Fechamento',        5, 'blue')
) AS s(name, position, color)
WHERE NOT EXISTS (SELECT 1 FROM public.stages LIMIT 1);

-- Backfill: criar profiles para usuários já existentes sem perfil
INSERT INTO public.profiles (id, full_name, email)
SELECT u.id, split_part(u.email,'@',1), u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
