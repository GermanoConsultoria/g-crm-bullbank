-- Unifica as tabelas clients e partners numa única public.contacts,
-- diferenciadas pela coluna type ('cliente' | 'parceiro'). Motivo: os dois
-- cadastros tinham praticamente o mesmo formulário (nome, empresa, e-mail,
-- telefone, observações); agora a tela "Contatos" filtra por type em vez de
-- serem duas telas/tabelas separadas.
--
-- Preserva as regras de cada tipo original:
--   - cliente: escopado por vendedor (owner_id), pode ser apagado.
--   - parceiro: diretório compartilhado (todo autenticado vê todos), só
--     admin edita, nunca é apagado (só desativado via is_active).

CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('cliente', 'parceiro')),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  -- Específicos de cliente.
  lead_type TEXT,
  source TEXT,
  -- Específicos de parceiro.
  document TEXT,
  segment TEXT,
  specialty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  legacy_form_submission_id UUID UNIQUE REFERENCES public.form_submissions ON DELETE SET NULL,
  import_review_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.contacts (
  id, type, owner_id, name, company, email, phone, notes,
  lead_type, source, created_at, updated_at
)
SELECT
  c.id, 'cliente', c.owner_id, c.name, c.company, c.email, c.phone, c.notes,
  c.lead_type, c.source, c.created_at, c.created_at
FROM public.clients c;

-- COALESCE cobre o caso raro de um parceiro legado sem created_by (o
-- cadastro não tem dono aparente); cai para o primeiro admin encontrado,
-- já que owner_id é NOT NULL em contacts.
INSERT INTO public.contacts (
  id, type, owner_id, name, company, email, phone, notes,
  document, segment, specialty, is_active, legacy_form_submission_id,
  import_review_reason, created_at, updated_at
)
SELECT
  p.id, 'parceiro',
  COALESCE(p.created_by, (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' LIMIT 1)),
  p.name, p.company, p.email, p.phone, p.notes,
  p.document, p.segment, p.specialty, p.is_active, p.legacy_form_submission_id,
  p.import_review_reason, p.created_at, p.updated_at
FROM public.partners p;

-- Repontar deals.client_id e tasks.client_id para a nova tabela (os IDs
-- foram preservados na cópia acima, então nenhum dado muda de FK).
ALTER TABLE public.deals DROP CONSTRAINT deals_client_id_fkey;
ALTER TABLE public.deals ADD CONSTRAINT deals_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT tasks_client_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.contacts(id) ON DELETE CASCADE;

DROP TABLE public.partners;
DROP TABLE public.clients;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Parceiro é visível a todo autenticado; cliente só ao próprio vendedor ou admin.
CREATE POLICY "contacts_select_scoped" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    type = 'parceiro'
    OR (type = 'cliente' AND (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')))
  );

CREATE POLICY "contacts_insert_own_or_admin" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- Cliente: dono ou admin editam. Parceiro: só admin (igual à regra anterior).
CREATE POLICY "contacts_update_scoped" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    (type = 'cliente' AND (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')))
    OR (type = 'parceiro' AND public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    (type = 'cliente' AND (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')))
    OR (type = 'parceiro' AND public.has_role(auth.uid(), 'admin'))
  );

-- Só cliente pode ser apagado; parceiro nunca (preserva histórico, só desativa).
CREATE POLICY "contacts_delete_clients_only" ON public.contacts
  FOR DELETE TO authenticated
  USING (type = 'cliente' AND (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')));
