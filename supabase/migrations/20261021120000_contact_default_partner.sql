-- Permite cadastrar, no próprio CLIENTE, um parceiro indicador padrão e a
-- taxa de comissão que ele ganha por indicação. Hoje esses dois dados só
-- existem por negócio (deals.partner_id / deals.partner_commission_rate),
-- escolhidos manualmente a cada negócio criado no funil. Os campos aqui
-- servem só como valor padrão de preenchimento ao criar um negócio desse
-- cliente (ver pré-preenchimento em funil.$funnelId.tsx) — o snapshot
-- gravado em cada deal continua sendo a fonte de verdade para o cálculo de
-- comissão, então alterar o padrão do cliente não afeta negócios já criados.
--
-- Só fazem sentido para contacts.type = 'cliente'; não há CHECK amarrando
-- isso (mesma decisão já tomada em deals.partner_id, que também não valida
-- o type do contato referenciado).

ALTER TABLE public.contacts
  ADD COLUMN default_partner_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN default_partner_commission_rate NUMERIC;
