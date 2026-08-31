-- Rimuove bills.nome_pdf_lower: il lookup del PDF passa su idboll.
--
-- Contesto: la 20260721000000 aveva aggiunto
--   nome_pdf_lower text generated always as (lower(nome_pdf)) stored + unique index
-- per togliere l'`UPDATE bills ... WHERE nome_pdf ILIKE $1` dal percorso di
-- import (era ~99,7% della CPU del DB: una chiamata per PDF, ~55k per run).
-- Serviva una colonna reale perché PostgREST filtra solo su colonne, non su
-- espressioni: un indice funzionale su lower(nome_pdf) non è raggiungibile da
-- supabase-js.
--
-- Perché si può togliere (verificato su tutte le 298.231 righe, 2026-08-31):
--   nome_pdf <> lower(nome_pdf)        -> 0 righe   (nomi sempre minuscoli)
--   nome_pdf <> idboll || '.pdf'       -> 0 righe   (nome = idboll + estensione)
--   idboll IS NULL / nome_pdf IS NULL  -> 0 righe
-- I nomi li produce il gestionale nella forma `<cifre>.pdf` e non dipende da noi.
-- Quindi la chiave di lookup esisteva già: idboll, bigint UNIQUE, quindi
-- indicizzato. Un confronto su intero contro un indice esistente costa meno di
-- qualunque indice di testo, e la colonna generata era un doppione esatto.
--
-- Il codice ora aggancia con .eq('idboll', parseInt(basename)) invece che sul
-- nome file (src/lib/admin/import/pdf-archive.ts, scripts/r2-upload-missing.ts).
-- Nota semantica: un ipotetico `0123.pdf` aggancerebbe la bolletta 123, dove
-- prima non avrebbe corrisposto. Oggi non esistono nomi non canonici (0 righe),
-- e pdf_url resterebbe comunque la chiave reale dell'oggetto su R2.
--
-- nome_pdf NON viene toccata: resta il nome mostrato in download e nella ricerca
-- admin. Nessun lock in scrittura, nessun indice da costruire.

-- 1. Salvaguardia: se l'assunzione non regge più, fermati prima di toccare lo schema.
do $$
declare
    bad_derived bigint;
    bad_null bigint;
begin
    select count(*) into bad_derived
      from public.bills
     where idboll is null
        or nome_pdf is null
        or nome_pdf <> (idboll::text || '.pdf');

    select count(*) into bad_null from public.bills where idboll is null;

    if bad_derived > 0 then
        raise exception
            'Interrotto: % righe dove nome_pdf non e'' idboll || ''.pdf''. Il lookup su idboll perderebbe quei PDF.',
            bad_derived;
    end if;
    if bad_null > 0 then
        raise exception 'Interrotto: % righe con idboll NULL: non sono agganciabili per idboll.', bad_null;
    end if;
end $$;

-- 2. Via la colonna generata (si porta dietro il suo indice bills_nome_pdf_lower_uidx).
alter table public.bills
    drop column if exists nome_pdf_lower;

-- 3. Documenta a schema il doppio ruolo di idboll, per chi apre la tabella in Studio.
comment on column public.bills.idboll is
    'Numero bolletta, ricavato dal nome del PDF (`<idboll>.pdf`). UNIQUE: e'' anche la chiave con cui l''import aggancia il PDF su R2 alla bolletta (vedi pdf-archive.ts). Sostituisce la colonna generata nome_pdf_lower, rimossa il 2026-08-31.';

comment on column public.bills.nome_pdf is
    'Nome del file PDF, sempre `<idboll>.pdf` minuscolo (lo produce il gestionale). Usato come nome del file in download e nella ricerca admin, NON come chiave di lookup: per quella si usa idboll.';

notify pgrst, 'reload schema';
