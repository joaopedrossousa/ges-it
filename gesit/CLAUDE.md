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
- CPF e e-mail do usuário são opcionais (migration 013): vazio é null, nunca "". Sem um deles = "Dados pendentes" (descreverPendencias em src/lib/colaboradores.ts). Exibir vazio como "—" (mascararCPF/formatarCPF já fazem isso).
- Um dispositivo tem no máximo um vínculo aberto (data_fim nula). Vincular usa a função SQL vincular_dispositivo.
- Termos de responsabilidade: PDF, até 5 MB, bucket privado "termos", enviados direto do navegador para o Storage.
- Notas fiscais: PDF, JPG ou PNG, até 10 MB, bucket privado "notas-fiscais", em {dispositivo_id}/{timestamp}.{ext}. Enviadas do navegador depois de salvar o dispositivo e gravadas com anexarNotaFiscal; abertas por /api/notas-fiscais (URL assinada no clique).
- Tipos de dispositivo: notebook (exige serial), telefone (exige IMEI 1; só ele tem linha e operadora) e monitor (exige patrimônio; sem serial nem IMEI). Identificador exibido: IMEI 1, patrimônio ou serial (identificadorDispositivo).
- Periféricos e formatação (migration 010): notebook → carregador, headset, mouse, suporte_notebook; telefone → carregador, chip; monitor → nenhum e sem "formatado" (null). Regra no banco em normalizar_perifericos e na app em src/lib/perifericos.ts (manter as duas iguais). perifericos_devolucao null = não conferido (vínculo aberto, transferência ou anterior à 010).
- Serviços (migration 011): tabela servicos, sem delete; o update só alcança os campos editáveis (grant por coluna). Anexo em bucket privado "servicos" ({dispositivo_id}/{timestamp}.{ext}), enviado depois de salvar e gravado com anexarArquivoServico; aberto por /api/servicos/anexo. Upload e validação de anexos (nota fiscal e serviço) em src/lib/anexos.ts. Relatório usa vw_servicos (loja e usuário do vínculo aberto na data do serviço).
- Auditoria (migration 012): trigger registrar_auditoria (after insert/update) em lojas, colaboradores, dispositivos, vinculos e servicos grava só os campos que mudaram, com CPF já mascarado. Tabela auditoria é somente leitura para a app. Nomes de campo e formatação em src/lib/auditoria.ts (ao criar coluna nova numa dessas tabelas, dar o rótulo em CAMPOS); resolução de nomes/e-mails em src/lib/auditoria-servidor.ts. Exportação só em Excel (RELATORIOS_SO_EXCEL).
- Filial de estoque (migration 014): dispositivos.loja_estoque_id, onde o aparelho fica sem vínculo. vw_dispositivos.loja_atual_id/nome = loja do vínculo aberto, senão a de estoque (listagem, filtro de loja e inventário usam essa). devolver_dispositivo grava a filial escolhida (padrão: a loja do vínculo). Gráficos "Ativos por filial" do Dashboard leem vw_ativos_por_filial (Recharts via src/components/ui/chart.tsx).
- Vida útil: situacao_vida_util vem da vw_dispositivos (ok, proximo, vencido, sem_data, baixado), calculada com a data de Palmas. Datas sem hora ("AAAA-MM-DD") exibidas com formatarDataISO, nunca via new Date().
- Campos de formulário (não usar os nativos, que seguem o idioma do navegador):
  - Datas: CampoData (src/components/campo-data.tsx), dd/mm/aaaa com calendário pt-BR (react-day-picker); o valor trafega como "AAAA-MM-DD". Nos formulários, usar `emitirInvalido` para o zod acusar texto incompleto.
  - Arquivos: CampoArquivo (src/components/campo-arquivo.tsx); o pai valida e guarda o File.
  - Listas longas já carregadas (lojas, operadora, tipo de serviço, usuários da auditoria): ComboboxLista (src/components/combobox-lista.tsx), busca sem acento por qualquer parte do texto. Lojas via opcoesLojas (nome + cidade). Busca no servidor (dispositivos, usuários no vínculo): ComboboxBusca.
- Textos curtos da interface (subtítulos, detalhes, valores avulsos) começam com maiúscula.
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

## Relatórios (PDF e Excel)
- Rota única: GET /api/relatorios/[tipo]?formato=pdf|xlsx + filtros. Gerados no servidor com a sessão do usuário (RLS); nada de service_role.
- Dados em src/lib/relatorios/dados.ts (um gerador por relatório); excel.ts (exceljs) e pdf.tsx (@react-pdf/renderer) só formatam o modelo de tipos.ts.
- Limite: 5.000 linhas por relatório; o PDF aceita até 1.000 (react-pdf ~4 ms/linha; a função da Netlify cai em 10 s). Acima disso, erro 422 pedindo para refinar os filtros.
- O PostgREST devolve no máximo 1.000 linhas por resposta: buscar com buscarTodas (lotes, ordenação estável terminando em id).
- PDF com paginação manual (um <Page> por bloco, wrap={false}) e células de uma linha (reticências): não trocar por quebra automática, que é quadrática. Ao mudar fontes, margens ou alturas, conferir que nenhuma página transborda.
- CPF sempre mascarado (mascararCPF). Datas no fuso de Palmas (America/Araguaina); no Excel, via paraRelogioDePalmas.
- Arquivos lidos do disco (fontes Roboto do @fontsource/roboto e public/brand/logo-horizontal-pdf.png) estão em outputFileTracingIncludes no next.config.ts.

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