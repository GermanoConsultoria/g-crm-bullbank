-- funnels: permite múltiplos funis de vendas (antes só existia um único funil implícito).
-- Etapas passam a pertencer a um funil; etapas existentes são migradas para um "Funil padrão".
CREATE TABLE public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funnels TO authenticated;
GRANT ALL ON public.funnels TO service_role;
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;

-- Mesma política liberal já usada em stages (qualquer usuário autenticado gerencia).
CREATE POLICY "funnels_select_all" ON public.funnels FOR SELECT TO authenticated USING (true);
CREATE POLICY "funnels_insert" ON public.funnels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "funnels_update" ON public.funnels FOR UPDATE TO authenticated USING (true);
CREATE POLICY "funnels_delete" ON public.funnels FOR DELETE TO authenticated USING (true);

INSERT INTO public.funnels (name, position) VALUES ('Funil padrão', 0);

ALTER TABLE public.stages ADD COLUMN funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE;
UPDATE public.stages SET funnel_id = (SELECT id FROM public.funnels ORDER BY created_at LIMIT 1);
ALTER TABLE public.stages ALTER COLUMN funnel_id SET NOT NULL;
