-- Bug: upsert_profile() inseria uma role 'vendedor' mesmo quando o usuário
-- já tinha uma role diferente (ex: 'admin'), porque o ON CONFLICT DO NOTHING
-- só evita duplicar o PAR (user_id, role) exato — não impede um segundo
-- registro com role diferente pro mesmo usuário. Resultado: um usuário
-- (tipicamente o primeiro admin, cujo client chama esse fallback no login)
-- podia acabar com duas linhas em user_roles (admin + vendedor), quebrando
-- qualquer código que trate role como única por usuário (ex: listas que só
-- devem mostrar vendedores).

-- Limpa o estado já corrompido: quem tem role 'admin' não deveria ter
-- nenhuma outra role.
DELETE FROM public.user_roles ur
WHERE ur.role <> 'admin'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'admin'
  );

CREATE OR REPLACE FUNCTION public.upsert_profile(
  p_id uuid,
  p_full_name text,
  p_email text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (p_id, p_full_name, p_email)
  ON CONFLICT (id) DO UPDATE
    SET email     = EXCLUDED.email,
        full_name = CASE WHEN profiles.full_name = '' THEN EXCLUDED.full_name ELSE profiles.full_name END;

  -- Role só inserida se o usuário ainda não tiver NENHUMA — checagem
  -- explícita por user_id, não mais um ON CONFLICT que só pegava o par
  -- (user_id, role) exato.
  INSERT INTO public.user_roles (user_id, role)
  SELECT p_id, 'vendedor'::public.app_role
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_id);
END;
$$;
