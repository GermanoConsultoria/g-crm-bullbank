-- Fix 1: RLS de stages restrita a admin
DROP POLICY IF EXISTS "stages_write"  ON public.stages;
DROP POLICY IF EXISTS "stages_update" ON public.stages;
DROP POLICY IF EXISTS "stages_delete" ON public.stages;

CREATE POLICY "stages_write"  ON public.stages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "stages_update" ON public.stages FOR UPDATE TO authenticated USING  (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "stages_delete" ON public.stages FOR DELETE TO authenticated USING  (public.has_role(auth.uid(), 'admin'));

-- Fix 2: upsert_profile não pode promover a admin via RPC
-- A lógica de role agora é exclusiva do trigger on_auth_user_created (SECURITY DEFINER).
-- A RPC só faz upsert do profile; a inserção de role acontece só se ainda não existir uma.
CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id uuid,
  p_full_name text,
  p_email text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Garante que o chamador só pode atualizar o próprio perfil
  IF auth.uid() IS DISTINCT FROM p_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (p_id, p_full_name, p_email)
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

  -- Role só inserida se o usuário ainda não tiver nenhuma (fallback do trigger)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_id, 'vendedor'::public.app_role)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_profile(uuid, text, text) TO authenticated;
