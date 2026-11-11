-- =========================================================
-- GesIT — 008 Tipo de dispositivo "monitor"
-- =========================================================
-- Rode SOZINHA, antes da 009 e em execução separada.
-- O Postgres não deixa usar um valor novo de enum na mesma transação em
-- que ele foi criado, e a 009 já usa 'monitor' nas checks e na view.
alter type public.tipo_dispositivo add value if not exists 'monitor';
