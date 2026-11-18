# GesIT Produtécnica

Plataforma web interna de gestão de T.I. da Produtécnica Agro: ativos e imobilizados com histórico de uso, gestão financeira das despesas de T.I., quadro de atividades da equipe e avisos automáticos no Telegram.

> Sistema de uso interno. O acesso é restrito a usuários cadastrados pela equipe de T.I.; não há cadastro público.

---

## Funcionalidades

### Início
- Bloco de **Urgentes** em destaque no topo.
- **Contas vencidas** e **próximas do vencimento** (7 dias).
- **Meus cards**: atividades atribuídas ao usuário logado.
- **Atividades recentes** do quadro e **resumo de movimentações** de dispositivos (últimos 7 dias).

### Ativos e Imobilizados
- **Colaboradores**: nome, cargo, filial, CPF e e-mail corporativo (opcionais), com inativação bloqueada enquanto houver dispositivo vinculado.
- **Dispositivos**: notebooks, telefones (IMEI 1/2, número, operadora), monitores e **infraestrutura** (access points, switches, firewalls etc.), com patrimônio, data de compra, nota fiscal, vida útil com alerta por cores e filial de estoque.
- **Vínculos**: entrega, transferência e devolução com histórico completo, periféricos e **Termo de Responsabilidade** em PDF. Itens de infraestrutura pertencem à filial e não são vinculados a pessoas.
- **Imagens do estado do item** no cadastro, na entrega, na transferência e na devolução (colar print, arrastar ou escolher arquivo).
- **Baixa** com formulário obrigatório (motivo, informações, data e anexos, como boletim de ocorrência).
- **Histórico de serviços** (manutenções) e **dashboard** com totais por filial.

### Gestão Financeira
- Catálogo de **serviços recorrentes** (provedores de internet, sistemas, telefonia) e **lançamentos manuais** por competência.
- Situações: pago, não pago, enviado ao financeiro, solicitado ao compras e cancelado; comprovantes anexados.
- **Painel** com despesas mensais, evolução mensal e **evolução por fornecedor ou serviço** (gráfico com seleção de séries, escala logarítmica e tabela com variação mês a mês).

### Atividades (Kanban)
- Quadro com colunas e **categorias** personalizáveis (nome e cor).
- Cartões com prioridade, responsável, prazo, categorias e marca de **urgente**.
- **Comentários** com imagens e prints.
- Arrastar e soltar com mouse, toque e teclado.
- Tela de **Concluídas** com filtros por mês e responsável.

### Relatórios
- Exportação em **PDF** e **Excel**: inventário, dispositivos por loja, vínculos sem termo, histórico do colaborador, serviços, infraestrutura por filial, baixas por período, financeiro e atividades concluídas.

### Administração
- **Lojas/filiais**.
- **Usuários do sistema**: nome de exibição usado em todo o app e nos avisos.
- **Auditoria**: registro de todas as alterações, com quem fez, quando e o valor antigo e o novo.

### Avisos no Telegram
- Aviso imediato quando um cartão é marcado como **urgente**.
- **Resumo das contas** às 08:00 e às 14:00 (horário de Palmas): vencidas, que vencem hoje e nos próximos 5 dias.
- Tudo roda no banco (`pg_cron` + `pg_net`), sem depender do site estar no ar.

---

## Tecnologias

| Camada | Ferramenta |
| --- | --- |
| Front-end e servidor | [Next.js](https://nextjs.org) (App Router), TypeScript, Tailwind CSS, [shadcn/ui](https://ui.shadcn.com) |
| Formulários e validação | react-hook-form, zod |
| Gráficos | Recharts |
| Arrastar e soltar | dnd-kit |
| Relatórios | @react-pdf/renderer (PDF), exceljs (Excel) |
| Banco, autenticação e arquivos | [Supabase](https://supabase.com) (Postgres, Auth, Storage, Vault, pg_cron, pg_net) |
| Hospedagem | [Netlify](https://www.netlify.com) |
| Agendamentos auxiliares | GitHub Actions |

---

## Arquitetura e regras do banco

- **Row Level Security** em todas as tabelas; o cliente usa apenas a chave pública (publishable).
- Escritas sensíveis passam por **funções `security definer`** com `search_path = ''` (vincular, devolver, baixar, mover atividade etc.), nunca por `UPDATE` direto.
- **Sem exclusão física**: registros são inativados, arquivados ou marcados como removidos, preservando o histórico.
- Um dispositivo só pode ter **um vínculo aberto** por vez, garantido por índice parcial, e o status é coerente com o vínculo (trigger).
- **Arquivos** em buckets privados, acessados por URLs assinadas de 60 segundos.
- **Auditoria** por triggers em todas as tabelas principais.

---

## Como rodar localmente

### Pré-requisitos
- Node.js 20 ou superior
- Uma conta no Supabase (plano Free atende)

### Passos

```bash
git clone <url-do-repositorio>
cd GesIT/gesit
npm install
```

Crie o arquivo `gesit/.env.local` (ele não vai para o Git):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sua-chave-publishable>
```

Aplique as migrations de `gesit/supabase/migrations/` **em ordem numérica** no SQL Editor do Supabase (copie cada arquivo inteiro) e depois gere os tipos:

```bash
npm run gen:types
npm run dev
```

O app abre em `http://localhost:3000`. Crie os usuários de acesso pelo painel do Supabase (*Authentication → Users*), com o cadastro público desligado.

### Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | Verificação de código |
| `npm run gen:types` | Gera `src/lib/database.types.ts` a partir do banco remoto |

---

## Deploy

1. Conecte o repositório ao Netlify com **Base directory** `gesit` (o `netlify.toml` já configura o build e o plugin `@netlify/plugin-nextjs`).
2. Cadastre as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no Netlify.
3. Cada `git push` na branch `main` gera um deploy. No plano gratuito, agrupe as alterações para economizar créditos.

### Manter o Supabase ativo
O workflow `.github/workflows/supabase-keepalive.yml` chama o banco a cada 3 dias para o projeto gratuito não ser pausado. Cadastre `SUPABASE_URL` e `SUPABASE_ANON_KEY` em *Settings → Secrets and variables → Actions* do GitHub.

### Avisos no Telegram
1. Crie um bot com o `@BotFather` e adicione-o ao grupo que vai receber os avisos.
2. No Supabase, em *Integrations → Vault*, crie os segredos `telegram_bot_token`, `telegram_chat_id` e `app_url` (endereço do site, sem barra no final).
3. As migrations ativam `pg_net` e `pg_cron` e agendam os resumos.
4. Teste no SQL Editor com `select public.enviar_telegram_teste();`.

---

## Estrutura

```
GesIT/
├── .github/workflows/        # keepalive do Supabase
└── gesit/
    ├── src/
    │   ├── app/              # rotas (Início, ativos, financeiro, atividades, relatórios, administração)
    │   ├── components/       # componentes de interface
    │   └── lib/              # Supabase, tipos, validações, auditoria, utilitários
    ├── supabase/migrations/  # SQL do banco, numerado em ordem
    ├── CLAUDE.md             # regras do projeto para o assistente de código
    └── netlify.toml
```

---

## Segurança

- Nunca versione `.env.local`, tokens, chaves de serviço ou cargas de dados reais (`carga-local/` e `.tmp/` estão no `.gitignore`).
- Segredos de integrações (Telegram) ficam apenas no Vault do Supabase.
- Os avisos do Telegram não incluem CPF, serial ou identificadores sensíveis.

---

Desenvolvido pela equipe de T.I. da Produtécnica Agro.
