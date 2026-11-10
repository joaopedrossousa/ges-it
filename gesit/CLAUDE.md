# GesIT Produtécnica

Plataforma interna de gestão de T.I. Módulo atual: Gestão de Ativos.

## Stack
- Next.js (App Router, TypeScript, src/), Tailwind, shadcn/ui
- Supabase (Postgres, Auth, Storage) via @supabase/ssr
- Validação com zod + react-hook-form
- Deploy: Netlify

## Regras
- Interface e mensagens em português do Brasil.
- Mutações via Server Actions em src/app/**/actions.ts; leitura em Server Components.
- Nunca usar a service_role key no código do cliente.
- CPF e IMEI guardados só com dígitos; máscara apenas na exibição.
- "Usuários" na UI = tabela colaboradores no banco.
- Um dispositivo tem no máximo um vínculo aberto (data_fim nula). Vincular usa a função SQL vincular_dispositivo.
- Termos de responsabilidade: PDF, até 5 MB, bucket privado "termos", enviados direto do navegador para o Storage.
- Antes de concluir uma tarefa: npm run lint e npm run build sem erros.

## Identidade visual (Produtécnica Agro)
- Fonte: Roboto (next/font/google, pesos 400, 500 e 700) via --font-sans; Roboto Mono via --font-mono. Definidas em src/app/layout.tsx.
- Cores: tokens do shadcn em src/app/globals.css (OKLCH, com o hex em comentário). Use os tokens/classes, nunca hex soltos.
  - primary / ring: azul #084897 (`brand-blue`), texto branco. Hover do primário: azul escuro #00225C (`primary-hover` / `brand-navy`).
  - Verde #009B67 (`brand-green`): só em ícones, bordas, badges e detalhes. Não usar como cor de texto pequeno sobre branco (3,6:1); para texto verde use `brand-green-strong` (#006B47).
  - accent (foco/hover em menus e selects): tinta clara do verde com texto `brand-green-strong`.
  - muted-foreground: #5F6C76 (família do cinza #AAB7C0, escurecido para AA no branco e no muted).
- Badges de status: Disponível no verde da marca (fundo `brand-green/15`, texto `brand-green-strong`); Em uso no azul da marca (fundo `brand-blue/10`, texto `brand-blue`); Manutenção âmbar; Baixado cinza.
- Logo: public/brand/logo-horizontal.png na tela de login (alt "Produtécnica Agro"); public/brand/simbolo.png ao lado de "GesIT" no menu lateral, que tem uma faixa azul no topo.
- Ícones do site: src/app/favicon.ico e src/app/icon.png (convenção de arquivos; não declarar `icons` no metadata).
- Carregamento: componente `Carregando` (src/components/carregando.tsx), três pontos azul/verde/azul em CSS. Usar nos loading.tsx (`CarregandoPagina`), nos botões enquanto salvam (`decorativo`, ao lado do texto "Salvando...") e em buscas. Não usar o carregando.gif (fundo branco) nem spinners genéricos.

## Git
- Ao concluir cada tarefa, com lint e build passando, faça commit local com mensagem no padrão Conventional Commits em português (ex.: "feat: dashboard de ativos").
- Antes do commit, mostre o git status e confira que .env.local e arquivos de cache não estão incluídos.
- Nunca rode git push, nunca use --force e nunca reescreva o histórico (rebase, reset --hard, amend em commits antigos).

## Tipos do banco
- Depois de alterar o SQL: rodar npm run gen:types.
- Colunas de vw_dispositivos vêm anuláveis nos tipos; tratar null ao exibir.
- Argumentos opcionais de RPC: converter null com ?? undefined.

## Estrutura
- src/lib/supabase/{client,server}.ts
- src/app/(app)/colaboradores, dispositivos, lojas
- supabase/migrations/*.sql