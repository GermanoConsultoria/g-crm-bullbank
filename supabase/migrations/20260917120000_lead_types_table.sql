-- lead_types: tabela administrável para os tipos de lead (antes hardcoded no front-end)
CREATE TABLE public.lead_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_types TO authenticated;
GRANT ALL ON public.lead_types TO service_role;
ALTER TABLE public.lead_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_types_select_all" ON public.lead_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_types_insert" ON public.lead_types FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lead_types_update" ON public.lead_types FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lead_types_delete" ON public.lead_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.lead_types (name, position) VALUES
  ('BNI', 1),
  ('Clientes', 2),
  ('Evento', 3),
  ('Ex-clientes', 4),
  ('Google Ads', 5),
  ('Indicação', 6),
  ('Instagram', 7),
  ('Parceiros', 8),
  ('Prospecção ativa', 9),
  ('Site', 10)
ON CONFLICT (name) DO NOTHING;
