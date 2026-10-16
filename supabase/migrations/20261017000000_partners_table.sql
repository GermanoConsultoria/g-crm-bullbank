-- Fase 1 do CRM: cadastro estruturado de parceiros (entidade própria, em vez
-- de registros soltos em form_submissions). Apenas cadastro e
-- ativação/desativação — sem comissão, sem vínculo com clients/deals.

CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  document TEXT,
  email TEXT,
  phone TEXT,
  segment TEXT,
  specialty TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- SET NULL (não CASCADE): o parceiro é uma entidade comercial que sobrevive
  -- ao funcionário que o cadastrou.
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  -- UNIQUE é a restrição que impede a mesma submissão legada de ser
  -- importada duas vezes; permite múltiplos NULL (cadastro manual, sem origem).
  legacy_form_submission_id UUID UNIQUE REFERENCES public.form_submissions ON DELETE SET NULL,
  -- Preenchido só pela migration de importação de dados legados, nunca pela UI.
  import_review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sem GRANT de DELETE para authenticated: nenhuma exclusão definitiva pela
-- aplicação, só ativação/desativação via UPDATE (preserva histórico).
GRANT SELECT, INSERT, UPDATE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Diretório compartilhado: qualquer autenticado vê todos os parceiros.
CREATE POLICY "partners_select_all" ON public.partners
  FOR SELECT TO authenticated
  USING (true);

-- Vendedor ou admin podem cadastrar (como já fazem hoje via /formularios).
CREATE POLICY "partners_insert_own_or_admin" ON public.partners
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- Só admin edita, ativa ou desativa.
CREATE POLICY "partners_update_admin_only" ON public.partners
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
