-- Ganhar/perder um negócio deixa de simplesmente tirá-lo do quadro kanban
-- (ele ficava só com status 'ganho'/'perdido' mas sem coluna que o mostrasse)
-- e passa a movê-lo visualmente para uma coluna fixa "Ganho" ou "Perdido"
-- dentro do próprio funil. `kind` marca essas duas colunas especiais; o
-- índice único garante só uma coluna de cada tipo por funil. Colunas normais
-- continuam com kind NULL.
ALTER TABLE public.stages
  ADD COLUMN kind TEXT CHECK (kind IN ('ganho', 'perdido'));

CREATE UNIQUE INDEX stages_funnel_kind_unique
  ON public.stages (funnel_id, kind)
  WHERE kind IS NOT NULL;

-- Backfill: todo funil já existente precisa ganhar as duas colunas fixas.
-- Funis criados depois dessa migration já nascem com elas (ver
-- funil.index.tsx), então este bloco só cobre o que já existia.
INSERT INTO public.stages (funnel_id, name, position, color, kind)
SELECT f.id, 'Ganho', COALESCE((SELECT MAX(s.position) FROM public.stages s WHERE s.funnel_id = f.id), 0) + 1, 'green', 'ganho'
FROM public.funnels f
WHERE NOT EXISTS (
  SELECT 1 FROM public.stages s WHERE s.funnel_id = f.id AND s.kind = 'ganho'
);

INSERT INTO public.stages (funnel_id, name, position, color, kind)
SELECT f.id, 'Perdido', COALESCE((SELECT MAX(s.position) FROM public.stages s WHERE s.funnel_id = f.id), 0) + 1, 'red', 'perdido'
FROM public.funnels f
WHERE NOT EXISTS (
  SELECT 1 FROM public.stages s WHERE s.funnel_id = f.id AND s.kind = 'perdido'
);
