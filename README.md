# BullBank CRM

CRM minimalista em tema escuro (azul, branco e cinza) para a equipe comercial do BullBank. Centraliza contatos, funis de vendas em kanban, tarefas, formulários de cadastro, relatórios de conversão e cálculo de comissões — com separação clara entre o que cada **vendedor** vê e o que o **administrador** gerencia.

> Projeto conectado ao [Lovable](https://lovable.dev/projects/228168fb-1e0f-42e1-800a-f31b9e5ece5f). Commits na branch `main` sincronizam com o editor do Lovable — mantenha a branch sempre funcionando e **nunca reescreva o histórico já enviado** (force push, rebase, amend ou squash de commits publicados).

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Perfis de acesso](#perfis-de-acesso)
- [Stack](#stack)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados (Supabase)](#banco-de-dados-supabase)
- [Deploy na Cloudflare](#deploy-na-cloudflare)
- [Scripts](#scripts)
- [Solução de problemas](#solução-de-problemas)

---

## Funcionalidades

| Módulo | Rota | Descrição |
| --- | --- | --- |
| **Dashboard** | `/dashboard` | Visão geral de negócios, conversão e metas. O admin vê todos os vendedores somados. |
| **Contatos** | `/clientes` | Cadastro e busca de clientes/leads. |
| **Funil** | `/funil`, `/funil/:funnelId` | Múltiplos funis de vendas em quadro kanban; etapas podem ser criadas, editadas, reordenadas e excluídas. |
| **Tarefas** | `/tarefas` | Tarefas vinculadas a negócios, para acompanhar a produtividade do vendedor. |
| **Formulários** | `/formularios` | Formulários de cadastro de **parceiro** e **cliente** (modelos em `src/lib/form-templates.ts`). |
| **Relatórios** | `/relatorios` | Análise de conversão por tipo de lead e desempenho. |
| **Comissões** | `/comissoes` | Comissão = taxa do vendedor (`commission_rate`, %) × soma dos negócios **ganhos**, com progresso da meta mensal. |
| **Tipos de lead** | `/tipos-de-lead` | *(admin)* Cadastro dos tipos/origens de lead usados nos relatórios. |
| **Usuários** | `/usuarios` | *(admin)* Criar, editar e ativar/desativar contas, definir perfil, taxa de comissão e meta. |

Outros comportamentos:

- **Troca de senha obrigatória** no primeiro acesso (`force_password_change`), via `ForcePasswordDialog`.
- Sidebar redimensionável/recolhível e layout responsivo para celular.

## Perfis de acesso

Os perfis ficam na tabela `user_roles` (enum `app_role`: `admin` | `vendedor`). Usuários sem registro são tratados como `vendedor`.

- **Vendedor** — vê apenas os **próprios** contatos, negócios, funis, tarefas e comissões (isolamento garantido por RLS no banco, não só na interface).
- **Admin** — não participa do grupo de vendas. No menu, tem Dashboard geral, Tipos de lead e Usuários, além de uma **pasta por vendedor** para navegar pelos dados de cada um.

Operações administrativas de usuários (`src/lib/admin-users.functions.ts`) rodam no servidor, verificam `has_role(..., 'admin')` e usam a `SUPABASE_SERVICE_ROLE_KEY`.

## Stack

- **Frontend/SSR:** React 19, [TanStack Start](https://tanstack.com/start) + TanStack Router (rotas por arquivo), TanStack Query
- **UI:** Tailwind CSS 4, Radix UI / shadcn-ui, lucide-react, Recharts, sonner
- **Formulários/validação:** react-hook-form + zod
- **Backend:** [Supabase](https://supabase.com) (Postgres, Auth, RLS)
- **Build:** Vite 8 + Nitro (preset Cloudflare) via `@lovable.dev/vite-tanstack-config`
- **Hospedagem:** Cloudflare Workers (assets estáticos + SSR)

## Estrutura do projeto

```
├── src/
│   ├── routes/                  # Rotas (TanStack Router, baseadas em arquivos)
│   │   ├── __root.tsx
│   │   ├── index.tsx            # Redireciona para /auth ou /dashboard
│   │   ├── auth.tsx             # Login
│   │   └── _authenticated/      # Rotas protegidas (dashboard, clientes, funil, ...)
│   ├── components/
│   │   ├── crm/                 # AppShell (menu/sidebar), ForcePasswordDialog
│   │   └── ui/                  # Componentes shadcn-ui
│   ├── integrations/supabase/   # Clientes Supabase (browser e servidor), tipos, middleware de auth
│   ├── lib/
│   │   ├── crm.ts               # Tipos, consultas e cálculo de comissão
│   │   ├── admin-users.functions.ts  # Server functions de gestão de usuários
│   │   └── form-templates.ts    # Modelos dos formulários
│   ├── routeTree.gen.ts         # GERADO automaticamente — não editar
│   └── server.ts                # Entrada do servidor (tratamento de erros de SSR)
├── supabase/
│   ├── migrations/              # Schema, RLS e funções do banco
│   └── seed.sql                 # Dados fictícios para demonstração
├── public/                      # Arquivos estáticos (favicon, marca)
├── vite.config.ts
└── wrangler.toml                # Configuração do Cloudflare Worker
```

## Rodando localmente

Pré-requisitos: **Node.js 22+** e npm (ou [Bun](https://bun.sh)).

```sh
git clone https://github.com/GermanoConsultoria/g-crm-bullbank.git
cd g-crm-bullbank
npm install
# crie o arquivo .env (veja a seção abaixo)
npm run dev
```

A aplicação sobe em `http://localhost:8080` (ou a porta indicada no terminal).

Para testar o build de produção no runtime da Cloudflare:

```sh
npm run build
npx wrangler dev
```

## Variáveis de ambiente

| Variável | Onde é usada | Pública? |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Navegador (injetada no build) | Sim |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Navegador (injetada no build) | Sim |
| `SUPABASE_URL` | Servidor (SSR / server functions) | Sim |
| `SUPABASE_PUBLISHABLE_KEY` | Servidor | Sim |
| `SUPABASE_PROJECT_ID` | Servidor | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Servidor — gestão de usuários | **NÃO — segredo** |

Arquivos:

- **`.env`** — desenvolvimento local, **não versionado**. Contém todas as variáveis acima.
- **`.env.production`** — versionado, **somente** as variáveis `VITE_*` públicas. Necessário porque o build na Cloudflare roda a partir do GitHub e não tem acesso ao `.env`; sem ele o app quebra no navegador com *"Missing Supabase environment variable(s)"*.
- **`wrangler.toml` → `[vars]`** — variáveis públicas do servidor em produção.

> ⚠️ Nunca coloque a `SUPABASE_SERVICE_ROLE_KEY` em arquivos versionados. Em produção ela é cadastrada como **Secret** na Cloudflare.

Exemplo de `.env` local:

```env
SUPABASE_PROJECT_ID=xxxxxxxxxxxxxxxx
SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=...

VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Banco de dados (Supabase)

Tabelas principais (`public`):

| Tabela | Conteúdo |
| --- | --- |
| `profiles` | Dados do usuário: nome, taxa de comissão, meta mensal, ativo, troca de senha obrigatória |
| `user_roles` | Perfil de cada usuário (`admin` / `vendedor`) |
| `clients` | Contatos/clientes |
| `funnels` | Funis de vendas (com dono) |
| `stages` | Etapas de cada funil (colunas do kanban) |
| `deals` | Negócios: valor, etapa, status (`ganho`, ...), tipo de lead, responsável |
| `lead_types` | Tipos/origens de lead |
| `tasks` | Tarefas vinculadas a negócios e vendedores |
| `form_submissions` | Respostas dos formulários de parceiro/cliente |

As permissões são aplicadas por **Row Level Security**. As migrations em `supabase/migrations/` devem ser aplicadas em ordem:

```sh
npx supabase link --project-ref <PROJECT_ID>
npx supabase db push
```

Ou cole cada arquivo, em ordem, no **SQL Editor** do painel do Supabase.

**Dados de demonstração:** `supabase/seed.sql` cria um admin, dois vendedores, clientes, negócios e tarefas fictícios. ⚠️ **Ele apaga os dados existentes** — use apenas em ambientes de teste.

## Deploy na Cloudflare

O deploy é feito pelo **Cloudflare Workers Builds**, conectado a este repositório: cada push na `main` gera um novo deploy.

### Configuração no painel

Em **Workers & Pages → g-crm-bullbank → Settings**:

| Campo | Valor |
| --- | --- |
| Nome do Worker | `g-crm-bullbank` (deve ser **igual** ao `name` do `wrangler.toml`) |
| Branch de produção | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Variables and Secrets | `SUPABASE_SERVICE_ROLE_KEY` como **Secret** |

### Como funciona

1. A Cloudflare instala as dependências (usa o `bun.lock`, com lockfile congelado — mantenha `bun.lock` e `package-lock.json` atualizados ao mudar dependências).
2. `npm run build` gera `.output/`: `public/` (assets) e `server/` (Worker), além de `.output/server/wrangler.json`, que **substitui** `main` e `assets` do `wrangler.toml`.
3. `npx wrangler deploy` publica o resultado. Ele **só funciona depois do build** — rodar sozinho falha porque `.output/` não existe.

### Deploy manual (pela sua máquina)

```sh
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # apenas na primeira vez
npm run deploy                                       # build + wrangler deploy
```

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (`.output/`) |
| `npm run build:dev` | Build em modo desenvolvimento |
| `npm run preview` | Pré-visualiza o build |
| `npm run deploy` | Build + deploy na Cloudflare |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Solução de problemas

| Sintoma | Causa provável / solução |
| --- | --- |
| Tela de erro com *"Missing Supabase environment variable(s)"* | Variáveis `VITE_*` ausentes no build. Confira o `.env.production` (produção) ou o `.env` (local). |
| Criar/editar usuários falha em produção | Falta o secret `SUPABASE_SERVICE_ROLE_KEY` no Worker. |
| Build da Cloudflare falha na instalação | `bun.lock` desatualizado em relação ao `package.json`. Rode `bun install` e faça commit do lockfile. |
| `wrangler deploy` reclama de arquivo/entrada inexistente | Rode `npm run build` antes (ou use `npm run deploy`). |
| Deploy falha com nome de Worker divergente | O nome do Worker no painel deve ser `g-crm-bullbank`. |
| Vendedor não vê dados que deveria | Verifique o `owner_id` do registro e as políticas RLS das migrations. |

---

Desenvolvido com [Lovable](https://lovable.dev) · Germano Consultoria
