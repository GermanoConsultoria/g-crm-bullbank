-- Recria função e trigger de forma robusta
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles) THEN 'admin'::public.app_role ELSE 'vendedor'::public.app_role END
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função RPC para upsert de perfil (chamada direto do frontend como fallback)
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id uuid,
  p_full_name text,
  p_email text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (p_id, p_full_name, p_email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    p_id,
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id != p_id) THEN 'admin'::public.app_role ELSE 'vendedor'::public.app_role END
  )
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_profile(uuid, text, text) TO authenticated;
