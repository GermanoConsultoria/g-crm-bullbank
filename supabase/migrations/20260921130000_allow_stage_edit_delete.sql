-- Libera edição e exclusão de etapas do funil para qualquer usuário autenticado
-- (antes restrito a admin pela migração 20260822020000_security_fixes.sql).
DROP POLICY IF EXISTS "stages_update" ON public.stages;
DROP POLICY IF EXISTS "stages_delete" ON public.stages;

CREATE POLICY "stages_update" ON public.stages FOR UPDATE TO authenticated USING (true);
CREATE POLICY "stages_delete" ON public.stages FOR DELETE TO authenticated USING (true);

-- Remove policy legada "stages: admin write" (FOR ALL, admin-only), criada fora do
-- histórico de migrations, que hoje é redundante e só confunde a leitura do RLS.
DROP POLICY IF EXISTS "stages: admin write" ON public.stages;
