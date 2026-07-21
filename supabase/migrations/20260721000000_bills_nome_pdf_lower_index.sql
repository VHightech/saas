-- Performance Advisor flagged one query as ~99.7% of all tracked DB CPU:
--   UPDATE bills SET pdf_url = ... WHERE nome_pdf ILIKE $1
-- Called once per PDF during import (src/lib/admin/import/pdf-archive.ts),
-- ~55k calls, ~2.75s mean, ~153.6M ms total. bills.nome_pdf has no index,
-- and ILIKE can't use a plain btree index anyway.
--
-- nome_pdf is NEVER NULL and 100% distinct (even case-folded) across all
-- 176,900 rows — safe as a unique, case-insensitive lookup key. Same
-- generated-column pattern as bills.ulm (20260420090000).

alter table public.bills
    add column if not exists nome_pdf_lower text generated always as (lower(nome_pdf)) stored;

create unique index if not exists bills_nome_pdf_lower_uidx
    on public.bills (nome_pdf_lower);

notify pgrst, 'reload schema';
