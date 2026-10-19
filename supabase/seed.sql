-- =============================================================
-- SEED — BullBank CRM  (dados fictícios para visualização)
-- Rode no SQL Editor do Supabase (Dashboard → SQL Editor)
-- ATENÇÃO: apaga todos os dados existentes antes de inserir.
--
-- Datas usam `now() - interval` em vez de datas fixas, então o seed
-- continua fazendo sentido não importa quando for executado — os offsets
-- abaixo foram escolhidos com folga pra cruzar com segurança os limites de
-- semana/mês/ano usados pelos filtros de período (ex: 45+ dias garante
-- "antes do início do mês atual" não importa o dia em que isso rodar;
-- 380+ dias garante "antes do início do ano atual").
-- =============================================================

DO $$
DECLARE
  uid_admin   uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  uid_vend1   uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  uid_vend2   uuid := 'cccccccc-0000-0000-0000-000000000003';

  -- clientes
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid();
  c6 uuid := gen_random_uuid();
  c7 uuid := gen_random_uuid();
  c8 uuid := gen_random_uuid();

  -- parceiros
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  p3 uuid := gen_random_uuid();

  -- um funil por vendedor (funis deixaram de ser globais)
  f_admin uuid := gen_random_uuid();
  f_vend1 uuid := gen_random_uuid();
  f_vend2 uuid := gen_random_uuid();

  -- deals
  d1  uuid := gen_random_uuid();
  d2  uuid := gen_random_uuid();
  d3  uuid := gen_random_uuid();
  d4  uuid := gen_random_uuid();
  d5  uuid := gen_random_uuid();
  d6  uuid := gen_random_uuid();
  d7  uuid := gen_random_uuid();
  d8  uuid := gen_random_uuid();
  d9  uuid := gen_random_uuid();
  d10 uuid := gen_random_uuid();
  d11 uuid := gen_random_uuid();
BEGIN

-- ── 1. LIMPAR dados anteriores ─────────────────────────────
DELETE FROM public.tasks;
DELETE FROM public.deals;
DELETE FROM public.contacts;
DELETE FROM public.stages;
DELETE FROM public.funnels;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM auth.users WHERE id IN (uid_admin, uid_vend1, uid_vend2);

-- ── 2. USUÁRIOS em auth.users ──────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  (uid_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@bullbank.com', crypt('senha123', gen_salt('bf')), now(),
   '{"full_name":"Rafael Souza"}'::jsonb, now(), now(), '', '', '', ''),
  (uid_vend1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'camila@bullbank.com', crypt('senha123', gen_salt('bf')), now(),
   '{"full_name":"Camila Torres"}'::jsonb, now(), now(), '', '', '', ''),
  (uid_vend2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lucas@bullbank.com', crypt('senha123', gen_salt('bf')), now(),
   '{"full_name":"Lucas Mendes"}'::jsonb, now(), now(), '', '', '', '');

-- ── 3. PROFILES ────────────────────────────────────────────
-- O trigger on_auth_user_created já criou os profiles; apenas atualiza com dados completos.
-- commission_rate aqui é só a taxa PADRÃO pré-preenchida ao criar negócios novos — a comissão
-- de cada negócio já fechado usa a taxa própria dele (deals.commission_rate), não esta.
INSERT INTO public.profiles (id, full_name, email, commission_rate, monthly_goal) VALUES
  (uid_admin, 'Rafael Souza',  'admin@bullbank.com',  8,  80000),
  (uid_vend1, 'Camila Torres', 'camila@bullbank.com', 6,  60000),
  (uid_vend2, 'Lucas Mendes',  'lucas@bullbank.com',  5,  50000)
ON CONFLICT (id) DO UPDATE
  SET full_name       = EXCLUDED.full_name,
      email           = EXCLUDED.email,
      commission_rate = EXCLUDED.commission_rate,
      monthly_goal    = EXCLUDED.monthly_goal;

-- ── 4. ROLES ───────────────────────────────────────────────
-- Trigger já inseriu as roles; garante que uid_admin seja admin e remove role errada se houver.
DELETE FROM public.user_roles WHERE user_id = uid_admin AND role = 'vendedor';
INSERT INTO public.user_roles (user_id, role) VALUES
  (uid_admin, 'admin'),
  (uid_vend1, 'vendedor'),
  (uid_vend2, 'vendedor')
ON CONFLICT DO NOTHING;

-- ── 5. FUNIS + ETAPAS ──────────────────────────────────────
-- Cada vendedor tem o próprio funil (estrutura não é mais global).
INSERT INTO public.funnels (id, name, position, owner_id) VALUES
  (f_admin, 'Funil de Vendas', 0, uid_admin),
  (f_vend1, 'Funil de Vendas', 0, uid_vend1),
  (f_vend2, 'Funil de Vendas', 0, uid_vend2);

INSERT INTO public.stages (id, funnel_id, name, position, color) VALUES
  (gen_random_uuid(), f_admin, 'Novo lead',        1, 'blue'),
  (gen_random_uuid(), f_admin, 'Contato feito',    2, 'blue'),
  (gen_random_uuid(), f_admin, 'Proposta enviada', 3, 'blue'),
  (gen_random_uuid(), f_admin, 'Negociação',       4, 'blue'),
  (gen_random_uuid(), f_admin, 'Fechamento',       5, 'blue'),
  (gen_random_uuid(), f_vend1, 'Novo lead',        1, 'blue'),
  (gen_random_uuid(), f_vend1, 'Contato feito',    2, 'blue'),
  (gen_random_uuid(), f_vend1, 'Proposta enviada', 3, 'blue'),
  (gen_random_uuid(), f_vend1, 'Negociação',       4, 'blue'),
  (gen_random_uuid(), f_vend1, 'Fechamento',       5, 'blue'),
  (gen_random_uuid(), f_vend2, 'Novo lead',        1, 'blue'),
  (gen_random_uuid(), f_vend2, 'Contato feito',    2, 'blue'),
  (gen_random_uuid(), f_vend2, 'Proposta enviada', 3, 'blue'),
  (gen_random_uuid(), f_vend2, 'Negociação',       4, 'blue'),
  (gen_random_uuid(), f_vend2, 'Fechamento',       5, 'blue');

-- ── 6. CLIENTES ────────────────────────────────────────────
-- Fernanda e Diego já estão marcados como churn (cancelados), pra ilustrar
-- a seção de Churn em /relatorios; Juliana e Carlos seguem ativos.
INSERT INTO public.contacts (
  id, type, owner_id, name, company, email, phone, lead_type, source, notes, churned_at, churn_reason
) VALUES
  (c1, 'cliente', uid_admin, 'Fernanda Lima',      'Lima Construções',     'fernanda@limaconstrucoes.com.br', '(11) 98765-4321', 'Indicação',        'Cliente antigo',        'Cliente desde o ano passado; cancelou o pacote empresarial recentemente.',
   now() - interval '3 days', 'Reduziu operação e não renovou o contrato anual.'),
  (c2, 'cliente', uid_admin, 'Bruno Alves',        'TechStart Ltda',       'bruno@techstart.com.br',          '(21) 99123-4567', 'Google Ads',        'Campanha maio/2026',    'Veio pelo anúncio de gestão de equipes.', NULL, NULL),
  (c3, 'cliente', uid_vend1, 'Mariana Costa',      'Costa & Filhos',       'mariana@costafilhos.com.br',      '(31) 97654-3210', 'Instagram',         'Post patrocinado',      'Quer migrar de planilha para CRM.', NULL, NULL),
  (c4, 'cliente', uid_vend1, 'Diego Ferreira',     'Ferreira Imóveis',     'diego@ferreiramoveis.com.br',     '(41) 96543-2109', 'Prospecção ativa',  NULL,                     'Migrou pro plano básico e depois cancelou.',
   now() - interval '4 days', 'Migrou para solução interna própria.'),
  (c5, 'cliente', uid_vend2, 'Juliana Ramos',      'Ramos Advocacia',      'juliana@ramosadv.com.br',         '(51) 95432-1098', 'Indicação',         'Rafael Souza',          'Advogada sócia, fechou licença para 5 usuários.', NULL, NULL),
  (c6, 'cliente', uid_vend2, 'Carlos Oliveira',    'Oliveira Seguros',     'carlos@oliveiraseguros.com.br',   '(61) 94321-0987', 'Evento',            'Feira Negócios 2026',   'Pegou folder no estande, fechou plano pro.', NULL, NULL),
  (c7, 'cliente', uid_admin, 'Priya Patel',        'Patel Importações',    'priya@patelimport.com.br',        '(11) 93210-9876', 'Site',              'Formulário de contato', 'Empresa de importação, 20 vendedores.', NULL, NULL),
  (c8, 'cliente', uid_vend1, 'Roberto Nascimento', 'Nascimento Logística', 'roberto@nasclog.com.br',          '(81) 92109-8765', 'Google Ads',        'Campanha junho/2026',   'Logística com 3 filiais, precisa de relatórios avançados.', NULL, NULL);

-- ── 7. PARCEIROS ───────────────────────────────────────────
-- Marcos (p3) está inativo, pra mostrar o estado desativado na aba Parceiros.
INSERT INTO public.contacts (
  id, type, owner_id, name, company, document, email, phone, segment, specialty, is_active, notes
) VALUES
  (p1, 'parceiro', uid_admin, 'Fábio Martins', 'Martins Consultoria Financeira', '12.345.678/0001-90', 'fabio@martinsconsultoria.com.br', '(11) 91234-5678', 'Consultoria financeira', 'Indicação de PMEs em expansão', true,
   'Indicou a conta da Lima Construções.'),
  (p2, 'parceiro', uid_vend2, 'Renata Souza',  'Souza Contabilidade',            '23.456.789/0001-01', 'renata@souzacontabil.com.br',      '(21) 92345-6789', 'Contabilidade',          'Clientes com faturamento recorrente', true,
   'Parceria recorrente com a carteira do Lucas.'),
  (p3, 'parceiro', uid_vend1, 'Marcos Lima',   'Lima Advocacia Empresarial',     '34.567.890/0001-12', 'marcos@limaadv.com.br',            '(31) 93456-7890', 'Jurídico empresarial',  'Due diligence pré-venda', false,
   'Parceria pausada — sem indicações nos últimos meses.');

-- ── 8. DEALS ───────────────────────────────────────────────
-- commission_rate é a taxa própria de cada negócio (não a taxa padrão do
-- vendedor); alguns têm taxa negociada acima/abaixo da padrão de propósito,
-- pra mostrar que não é mais uma taxa única. partner_id/partner_commission_rate
-- só nos negócios que vieram de indicação de parceiro.
INSERT INTO public.deals (
  id, owner_id, client_id, stage_id, title, value, status, lead_type,
  commission_rate, partner_id, partner_commission_rate, closed_at, created_at
) VALUES
  -- Rafael (admin)
  (d1, uid_admin, c1, (SELECT id FROM public.stages WHERE funnel_id = f_admin AND name = 'Fechamento'),
   'Contrato anual Lima Construções', 18500, 'ganho', 'Indicação',
   10, p1, 8, now() - interval '400 days', now() - interval '430 days'),
  (d2, uid_admin, c2, (SELECT id FROM public.stages WHERE funnel_id = f_admin AND name = 'Negociação'),
   'Piloto TechStart 3 meses', 4200, 'aberto', 'Google Ads',
   8, NULL, NULL, NULL, now() - interval '20 days'),
  (d3, uid_admin, c7, (SELECT id FROM public.stages WHERE funnel_id = f_admin AND name = 'Contato feito'),
   'Demo Patel Importações', 9800, 'aberto', 'Site',
   8, NULL, NULL, NULL, now() - interval '5 days'),
  (d4, uid_admin, c1, (SELECT id FROM public.stages WHERE funnel_id = f_admin AND name = 'Fechamento'),
   'Consultoria extra Lima Construções', 7000, 'ganho', 'Indicação',
   8, p1, 8, now() - interval '60 days', now() - interval '70 days'),

  -- Camila (vendedor)
  (d5, uid_vend1, c3, (SELECT id FROM public.stages WHERE funnel_id = f_vend1 AND name = 'Proposta enviada'),
   'Migração planilha → CRM Costa', 3600, 'aberto', 'Instagram',
   6, NULL, NULL, NULL, now() - interval '12 days'),
  (d6, uid_vend1, c4, (SELECT id FROM public.stages WHERE funnel_id = f_vend1 AND name = 'Fechamento'),
   'Ferreira Imóveis — plano básico', 2400, 'ganho', 'Prospecção ativa',
   8, NULL, NULL, now() - interval '60 days', now() - interval '75 days'),
  (d7, uid_vend1, c8, (SELECT id FROM public.stages WHERE funnel_id = f_vend1 AND name = 'Novo lead'),
   'Nascimento Logística — prospecção', 12000, 'aberto', 'Google Ads',
   6, NULL, NULL, NULL, now() - interval '2 days'),
  (d8, uid_vend1, c3, (SELECT id FROM public.stages WHERE funnel_id = f_vend1 AND name = 'Fechamento'),
   'Upsell Costa & Filhos', 1800, 'perdido', 'Instagram',
   6, NULL, NULL, now() - interval '7 days', now() - interval '25 days'),

  -- Lucas (vendedor)
  (d9, uid_vend2, c5, (SELECT id FROM public.stages WHERE funnel_id = f_vend2 AND name = 'Fechamento'),
   'Ramos Advocacia — 5 licenças', 6000, 'ganho', 'Indicação',
   5, p2, 10, now() - interval '60 days', now() - interval '75 days'),
  (d10, uid_vend2, c6, (SELECT id FROM public.stages WHERE funnel_id = f_vend2 AND name = 'Fechamento'),
   'Oliveira Seguros — plano pro', 5400, 'ganho', 'Evento',
   5, p2, 10, now() - interval '90 days', now() - interval '120 days'),
  (d11, uid_vend2, NULL, (SELECT id FROM public.stages WHERE funnel_id = f_vend2 AND name = 'Novo lead'),
   'Prospecção setor saúde', 3000, 'aberto', 'Prospecção ativa',
   5, NULL, NULL, NULL, now() - interval '1 day');

-- ── 9. TASKS ───────────────────────────────────────────────
INSERT INTO public.tasks (owner_id, deal_id, client_id, title, description, due_date, priority, done, completed_at) VALUES
  (uid_admin, d2,  c2,   'Enviar proposta TechStart',         'Incluir desconto de 10% para contrato semestral.',         current_date + 1,  'alta',  false, NULL),
  (uid_admin, d3,  c7,   'Agendar demo Patel Importações',    'Confirmar horário com Priya — manhã de preferência.',      current_date + 2,  'alta',  false, NULL),
  (uid_admin, NULL, NULL, 'Revisar metas do mês',              'Atualizar planilha de comissões com os fechamentos.',      current_date,      'media', false, NULL),
  (uid_admin, d1,  c1,   'Entender motivo do cancelamento',   'Fernanda cancelou o contrato anual — mapear se dá pra reverter.', current_date - 1, 'alta',  false, NULL),

  (uid_vend1, d5,  c3,   'Apresentar plano de migração',      'Mostrar template de importação de planilha.',              current_date + 3,  'media', false, NULL),
  (uid_vend1, d7,  c8,   'Ligar para Roberto Nascimento',     'Primeiro contato após preenchimento do formulário.',       current_date,      'alta',  false, NULL),
  (uid_vend1, d6,  c4,   'Follow-up pós-cancelamento Diego',  'Diego migrou pra solução própria — oferecer plano de retenção.', current_date + 1, 'media', false, NULL),

  (uid_vend2, d9,  c5,   'Onboarding Ramos Advocacia',        'Enviar credenciais das 5 licenças e agendar treinamento.', current_date - 2,  'media', true,  now() - interval '2 days'),
  (uid_vend2, d10, c6,   'Renovação Oliveira Seguros',        'Contrato vence em 60 dias — iniciar conversa de renovação.', current_date + 5, 'media', false, NULL),
  (uid_vend2, d11, NULL, 'Prospectar clientes do setor saúde','Meta: 5 contatos novos até sexta.',                        current_date + 4,  'baixa', false, NULL);

RAISE NOTICE '✅ Seed concluído! Usuários criados:';
RAISE NOTICE '   admin@bullbank.com  / senha123  (admin)';
RAISE NOTICE '   camila@bullbank.com / senha123  (vendedor)';
RAISE NOTICE '   lucas@bullbank.com  / senha123  (vendedor)';
RAISE NOTICE '   8 clientes (2 cancelados), 3 parceiros (1 inativo), 11 negócios, 3 funis.';

END $$;
