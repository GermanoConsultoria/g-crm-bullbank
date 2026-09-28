-- Funis (e suas etapas) deixam de ser uma estrutura global compartilhada:
-- cada vendedor tem os próprios funis. O admin não cadastra em nome
-- próprio — ele cria/edita dentro da pasta de um vendedor específico.

ALTER TABLE public.funnels ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users ON DELETE CASCADE;

-- Funis criados quando a estrutura ainda era compartilhada ficam com o
-- primeiro admin como dono; reatribua manualmente via SQL se precisar.
UPDATE public.funnels
SET owner_id = (SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY id LIMIT 1)
WHERE owner_id IS NULL;

ALTER TABLE public.funnels ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS "funnels_select_all" ON public.funnels;
CREATE POLICY "funnels_select_own_or_admin" ON public.funnels
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "funnels_insert" ON public.funnels;
CREATE POLICY "funnels_insert_own_or_admin" ON public.funnels
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "funnels_update" ON public.funnels;
CREATE POLICY "funnels_update_own_or_admin" ON public.funnels
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "funnels_delete" ON public.funnels;
CREATE POLICY "funnels_delete_own_or_admin" ON public.funnels
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- stages não têm dono próprio: a visibilidade segue o dono do funil ao
-- qual a etapa pertence.
DROP POLICY IF EXISTS "stages_select_all" ON public.stages;
CREATE POLICY "stages_select_own_or_admin" ON public.stages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = stages.funnel_id AND f.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "stages_write" ON public.stages;
CREATE POLICY "stages_write_own_or_admin" ON public.stages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = stages.funnel_id AND f.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "stages_update" ON public.stages;
CREATE POLICY "stages_update_own_or_admin" ON public.stages
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = stages.funnel_id AND f.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "stages_delete" ON public.stages;
CREATE POLICY "stages_delete_own_or_admin" ON public.stages
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = stages.funnel_id AND f.owner_id = auth.uid())
  );
