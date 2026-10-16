-- Copia form_submissions tipo 'parceiro' para partners como rascunho
-- inativo, para revisão do admin. Não altera nem apaga form_submissions.
-- Idempotente: a UNIQUE em partners.legacy_form_submission_id + ON CONFLICT
-- DO NOTHING garante que rodar esta migration mais de uma vez (ex: em
-- ambientes diferentes) nunca duplica registros.
INSERT INTO public.partners (
  name,
  company,
  segment,
  specialty,
  notes,
  created_by,
  legacy_form_submission_id,
  is_active,
  import_review_reason
)
SELECT
  fs.name,
  fs.company,
  NULLIF(trim(fs.data->>'segmento_atuacao'), ''),
  NULLIF(trim(fs.data->>'especialidade'), ''),
  NULLIF(trim(fs.data->>'observacoes'), ''),
  fs.owner_id,
  fs.id,
  false,
  trim(both ', ' from concat_ws(', ',
    CASE WHEN fs.name = 'Sem nome' OR trim(fs.name) = ''
         THEN 'Nome não informado no formulário original (valor de preenchimento automático)' END,
    CASE WHEN fs.company IS NULL OR trim(fs.company) = ''
         THEN 'Empresa não informada no formulário original' END,
    'Sem e-mail/telefone/documento no formulário original — confirmar contato antes de ativar'
  ))
FROM public.form_submissions fs
WHERE fs.type = 'parceiro'
ON CONFLICT (legacy_form_submission_id) DO NOTHING;
