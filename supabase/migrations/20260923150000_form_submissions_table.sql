-- form_submissions: registros dos formulários de parceiros e clientes preenchidos pelos usuários.
-- Os campos variam bastante entre os dois tipos, então ficam num JSONB (data); name/company são
-- extraídos para colunas próprias só para facilitar a listagem.
CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('parceiro', 'cliente')),
  name TEXT NOT NULL,
  company TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submissions TO authenticated;
GRANT ALL ON public.form_submissions TO service_role;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Mesma política liberal já usada em stages/funnels (qualquer usuário autenticado gerencia).
CREATE POLICY "form_submissions_select_all" ON public.form_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "form_submissions_insert" ON public.form_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "form_submissions_update" ON public.form_submissions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "form_submissions_delete" ON public.form_submissions FOR DELETE TO authenticated USING (true);
