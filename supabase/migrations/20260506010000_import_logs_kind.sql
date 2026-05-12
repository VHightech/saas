-- Migration: 20260506010000_import_logs_kind.sql
-- Description: Add `kind` column to import_logs so we can persist progress for
-- both bills uploads (kind='bills') and user CSV uploads (kind='users').
-- This lets the GlobalProgressBar resume after a page reload by polling the row
-- via r2_path (the importId).

alter table public.import_logs
    add column if not exists kind text not null default 'bills';

create index if not exists import_logs_kind_idx on public.import_logs(kind);

notify pgrst, 'reload schema';
