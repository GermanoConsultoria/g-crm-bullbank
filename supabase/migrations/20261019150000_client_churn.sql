-- Churn de clientes: um cliente vira "ativo" automaticamente ao ter o
-- primeiro negócio ganho (calculado em runtime, sem coluna própria); churn
-- é o cancelamento, registrado manualmente com data e motivo.
-- Só faz sentido pra type = 'cliente', mas fica nullable na tabela
-- unificada, mesmo padrão já usado pros campos específicos de cada tipo.
ALTER TABLE public.contacts
  ADD COLUMN churned_at TIMESTAMPTZ,
  ADD COLUMN churn_reason TEXT;
