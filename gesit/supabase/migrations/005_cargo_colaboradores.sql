-- =========================================================
-- GesIT — 005 Cargo dos colaboradores
-- =========================================================
-- Campo opcional "Cargo" no cadastro de usuários (colaboradores).
-- Vazio é gravado como null pela aplicação; o banco só limita o tamanho.
--
-- Tudo em uma transação: se algo falhar, nada é aplicado.
begin;

alter table public.colaboradores
  add column cargo text null
  constraint colaboradores_cargo_tamanho check (char_length(cargo) <= 100);

comment on column public.colaboradores.cargo is
  'Cargo do colaborador (opcional, até 100 caracteres).';

commit;
