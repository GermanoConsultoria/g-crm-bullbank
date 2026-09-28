-- Permite que qualquer usuário autenticado crie novas etapas no funil.
-- Renomear e excluir etapas continuam restritos a admin (stages_update / stages_delete).
DROP POLICY IF EXISTS "stages_write" ON public.stages;

CREATE POLICY "stages_write" ON public.stages FOR INSERT TO authenticated WITH CHECK (true);
