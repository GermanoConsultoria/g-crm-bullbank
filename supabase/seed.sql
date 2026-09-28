-- =============================================================
-- SEED — Blue Moon CRM  (dados fictícios para visualização)
-- Rode no SQL Editor do Supabase (Dashboard → SQL Editor)
-- ATENÇÃO: apaga todos os dados existentes antes de inserir.
-- =============================================================

-- IDs fixos para referenciar entre tabelas
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

  -- stages (já existem no seed padrão, mas garantimos aqui)
  s1 uuid; s2 uuid; s3 uuid; s4 uuid; s5 uuid;

  -- deals
  d1 uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  d3 uuid := gen_random_uuid();
  d4 uuid := gen_random_uuid();
  d5 uuid := gen_random_uuid();
  d6 uuid := gen_random_uuid();
  d7 uuid := gen_random_uuid();
  d8 uuid := gen_random_uuid();
  d9 uuid := gen_random_uuid();
  d10 uuid := gen_random_uuid();
BEGIN

-- ── 1. LIMPAR dados anteriores ─────────────────────────────
DELETE FROM public.tasks;
DELETE FROM public.deals;
DELETE FROM public.clients;
DELETE FROM public.stages;
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
   'admin@bluemoon.com', crypt('senha123', gen_salt('bf')), now(),
   '{"full_name":"Rafael Souza"}'::jsonb, now(), now(), '', '', '', ''),
  (uid_vend1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'camila@bluemoon.com', crypt('senha123', gen_salt('bf')), now(),
   '{"full_name":"Camila Torres"}'::jsonb, now(), now(), '', '', '', ''),
  (uid_vend2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lucas@bluemoon.com', crypt('senha123', gen_salt('bf')), now(),
   '{"full_name":"Lucas Mendes"}'::jsonb, now(), now(), '', '', '', '');

-- ── 3. PROFILES ────────────────────────────────────────────
-- O trigger on_auth_user_created já criou os profiles; apenas atualiza com dados completos.
INSERT INTO public.profiles (id, full_name, email, commission_rate, monthly_goal) VALUES
  (uid_admin, 'Rafael Souza',  'admin@bluemoon.com',  8,  80000),
  (uid_vend1, 'Camila Torres', 'camila@bluemoon.com', 6,  60000),
  (uid_vend2, 'Lucas Mendes',  'lucas@bluemoon.com',  5,  50000)
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

-- ── 5. STAGES ──────────────────────────────────────────────
INSERT INTO public.stages (id, name, position, color) VALUES
  (gen_random_uuid(), 'Novo lead',         1, 'blue'),
  (gen_random_uuid(), 'Contato feito',     2, 'blue'),
  (gen_random_uuid(), 'Proposta enviada',  3, 'blue'),
  (gen_random_uuid(), 'Negociação',        4, 'blue'),
  (gen_random_uuid(), 'Fechamento',        5, 'blue');

SELECT id INTO s1 FROM public.stages WHERE name = 'Novo lead'        LIMIT 1;
SELECT id INTO s2 FROM public.stages WHERE name = 'Contato feito'    LIMIT 1;
SELECT id INTO s3 FROM public.stages WHERE name = 'Proposta enviada' LIMIT 1;
SELECT id INTO s4 FROM public.stages WHERE name = 'Negociação'       LIMIT 1;
SELECT id INTO s5 FROM public.stages WHERE name = 'Fechamento'       LIMIT 1;

-- ── 6. CLIENTES ────────────────────────────────────────────
INSERT INTO public.clients (id, owner_id, name, company, email, phone, lead_type, source, notes) VALUES
  (c1, uid_admin, 'Fernanda Lima',     'Lima Construções',     'fernanda@limaconstrucoes.com.br', '(11) 98765-4321', 'Indicação',        'Cliente antigo',       'Interessada em pacote empresarial completo.'),
  (c2, uid_admin, 'Bruno Alves',       'TechStart Ltda',       'bruno@techstart.com.br',          '(21) 99123-4567', 'Google Ads',        'Campanha maio/2026',   'Veio pelo anúncio de gestão de equipes.'),
  (c3, uid_vend1, 'Mariana Costa',     'Costa & Filhos',       'mariana@costafilhos.com.br',      '(31) 97654-3210', 'Instagram',         'Post patrocinado',     'Quer migrar de planilha para CRM.'),
  (c4, uid_vend1, 'Diego Ferreira',    'Ferreira Imóveis',     'diego@ferreiramoveis.com.br',     '(41) 96543-2109', 'Prospecção ativa',  NULL,                   'Contato frio, demonstrou interesse após demo.'),
  (c5, uid_vend2, 'Juliana Ramos',     'Ramos Advocacia',      'juliana@ramosadv.com.br',         '(51) 95432-1098', 'Indicação',         'Rafael Souza',         'Advogada sócia, avalia licença para 5 usuários.'),
  (c6, uid_vend2, 'Carlos Oliveira',   'Oliveira Seguros',     'carlos@oliveiraseguros.com.br',   '(61) 94321-0987', 'Evento',            'Feira Negócios 2026',  'Pegou folder no estande, retornou por e-mail.'),
  (c7, uid_admin, 'Priya Patel',       'Patel Importações',    'priya@patelimport.com.br',        '(11) 93210-9876', 'Site',              'Formulário de contato','Empresa de importação, 20 vendedores.'),
  (c8, uid_vend1, 'Roberto Nascimento','Nascimento Logística',  'roberto@nasclog.com.br',          '(81) 92109-8765', 'Google Ads',        'Campanha junho/2026',  'Logística com 3 filiais, precisa de relatórios avançados.');

-- ── 7. DEALS ───────────────────────────────────────────────
INSERT INTO public.deals (id, owner_id, client_id, stage_id, title, value, status, lead_type, closed_at, created_at) VALUES
  -- Rafael (admin)
  (d1,  uid_admin, c1, s5, 'Contrato anual Lima Construções',   18500, 'ganho',    'Indicação',       now() - interval '10 days', now() - interval '45 days'),
  (d2,  uid_admin, c2, s4, 'Piloto TechStart 3 meses',          4200,  'aberto',   'Google Ads',      NULL,                       now() - interval '20 days'),
  (d3,  uid_admin, c7, s2, 'Demo Patel Importações',            9800,  'aberto',   'Site',            NULL,                       now() - interval '5 days'),
  (d4,  uid_admin, c1, s5, 'Renovação Lima Construções',        19500, 'ganho',    'Indicação',       now() - interval '2 days',  now() - interval '60 days'),

  -- Camila (vendedor)
  (d5,  uid_vend1, c3, s3, 'Migração planilha → CRM Costa',     3600,  'aberto',   'Instagram',       NULL,                       now() - interval '12 days'),
  (d6,  uid_vend1, c4, s5, 'Ferreira Imóveis — plano básico',   2400,  'ganho',    'Prospecção ativa',now() - interval '3 days',  now() - interval '30 days'),
  (d7,  uid_vend1, c8, s1, 'Nascimento Logística — prospecção', 12000, 'aberto',   'Google Ads',      NULL,                       now() - interval '2 days'),
  (d8,  uid_vend1, c3, s5, 'Upsell Costa & Filhos',             1800,  'perdido',  'Instagram',       now() - interval '7 days',  now() - interval '25 days'),

  -- Lucas (vendedor)
  (d9,  uid_vend2, c5, s4, 'Ramos Advocacia — 5 licenças',      6000,  'aberto',   'Indicação',       NULL,                       now() - interval '8 days'),
  (d10, uid_vend2, c6, s5, 'Oliveira Seguros — plano pro',      5400,  'ganho',    'Evento',          now() - interval '1 day',   now() - interval '35 days');

-- ── 8. TASKS ───────────────────────────────────────────────
INSERT INTO public.tasks (owner_id, deal_id, client_id, title, description, due_date, priority, done, completed_at) VALUES
  (uid_admin, d2,  c2,   'Enviar proposta TechStart',         'Incluir desconto de 10% para contrato semestral.',         current_date + 1,  'alta',  false, NULL),
  (uid_admin, d3,  c7,   'Agendar demo Patel Importações',    'Confirmar horário com Priya — manhã de preferência.',      current_date + 2,  'alta',  false, NULL),
  (uid_admin, NULL, NULL, 'Revisar metas do mês',              'Atualizar planilha de comissões com os fechamentos.',      current_date,      'media', false, NULL),
  (uid_admin, d1,  c1,   'Onboarding Lima Construções',       'Enviar credenciais e material de boas-vindas.',            current_date - 5,  'alta',  true,  now() - interval '4 days'),

  (uid_vend1, d5,  c3,   'Apresentar plano de migração',      'Mostrar template de importação de planilha.',              current_date + 3,  'media', false, NULL),
  (uid_vend1, d7,  c8,   'Ligar para Roberto Nascimento',     'Primeiro contato após preenchimento do formulário.',       current_date,      'alta',  false, NULL),
  (uid_vend1, d6,  c4,   'Enviar NF Ferreira Imóveis',        'NF referente ao primeiro mês do plano básico.',            current_date - 2,  'baixa', true,  now() - interval '2 days'),

  (uid_vend2, d9,  c5,   'Follow-up proposta Ramos Adv.',     'Juliana pediu 3 dias para avaliar com os sócios.',         current_date + 1,  'alta',  false, NULL),
  (uid_vend2, d10, c6,   'Enviar contrato Oliveira Seguros',  'Contrato assinado digitalmente via DocuSign.',             current_date - 1,  'media', true,  now() - interval '1 day'),
  (uid_vend2, NULL, NULL, 'Prospectar clientes do setor saúde','Meta: 5 contatos novos até sexta.',                        current_date + 4,  'baixa', false, NULL);

RAISE NOTICE '✅ Seed concluído! Usuários criados:';
RAISE NOTICE '   admin@bluemoon.com  / senha123  (admin)';
RAISE NOTICE '   camila@bluemoon.com / senha123  (vendedor)';
RAISE NOTICE '   lucas@bluemoon.com  / senha123  (vendedor)';

END $$;
