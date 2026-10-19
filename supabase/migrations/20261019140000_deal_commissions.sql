-- Comissão passa a ser por negócio, não mais uma taxa única do vendedor
-- aplicada a tudo. Cada deal ganha sua própria taxa (editável no funil,
-- pré-preenchida com a taxa padrão do vendedor ao criar) e, opcionalmente,
-- um parceiro indicador com taxa de comissão própria (paga quando o
-- negócio é marcado como ganho).

ALTER TABLE public.deals
  ADD COLUMN commission_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN partner_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN partner_commission_rate NUMERIC;

-- Backfill: negócios existentes herdam a taxa atual do vendedor, para o
-- total de comissão já calculado hoje não mudar com a migration.
UPDATE public.deals d
SET commission_rate = COALESCE(p.commission_rate, 0)
FROM public.profiles p
WHERE p.id = d.owner_id;
