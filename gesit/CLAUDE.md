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

## Estrutura
- src/lib/supabase/{client,server}.ts
- src/app/(app)/colaboradores, dispositivos, lojas
- supabase/migrations/*.sql