-- Rimuove bills.nome_pdf: il nome del PDF è derivabile da idboll.
--
-- Il gestionale esporta ogni PDF come `<idboll>.pdf` e non dipende da noi
-- (confermato dal committente, 2026-08-31). Verificato su tutte le 298.231
-- righe: nome_pdf <> idboll || '.pdf' → 0, idboll IS NULL → 0, nome_pdf IS NULL
-- → 0. La colonna era quindi la terza copia della stessa informazione, dopo la
-- generata nome_pdf_lower già rimossa dalla 20260831000000.
--
-- Il nome file ora si calcola in TypeScript: pdfNameForIdboll() in
-- src/lib/bill-pdf.ts, unico posto in cui vive la convenzione. `pdf_url` resta
-- la chiave reale dell'oggetto su R2 e NON viene toccata: i PDF già caricati
-- restano collegati esattamente come sono.
--
-- ORDINE DI APPLICAZIONE: prima il deploy del codice (che non legge né scrive
-- più nome_pdf), poi questa migration. Al contrario, le pagine ancora in
-- produzione selezionerebbero una colonna inesistente.
--
-- Dipendenze verificate prima di procedere:
--   • search_users (ultima definizione: 20260713000000) cerca già su
--     b.idboll::text, non su nome_pdf → la ricerca admin non si rompe.
--   • bills_created_at_idx (created_at desc, nome_pdf desc), creato dalla
--     20260630100000, viene rimosso da Postgres insieme alla colonna. Nessuna
--     query lo usa: tutte ordinano le bollette per data_emissione. Non va
--     ricreato su idboll senza prima misurare che serva davvero.

-- 1. Salvaguardia: se il nome non è più derivabile da idboll, fermati.
do $$
declare
    bad_derived bigint;
    bad_idboll bigint;
begin
    if exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'bills' and column_name = 'nome_pdf'
    ) then
        select count(*) into bad_derived
          from public.bills
         where nome_pdf is null
            or idboll is null
            or nome_pdf <> (idboll::text || '.pdf');
        if bad_derived > 0 then
            raise exception
                'Interrotto: % righe dove nome_pdf non e'' idboll || ''.pdf''. Quel nome andrebbe perso.',
                bad_derived;
        end if;
    end if;

    select count(*) into bad_idboll from public.bills where idboll is null;
    if bad_idboll > 0 then
        raise exception
            'Interrotto: % righe con idboll NULL. Senza idboll la bolletta non ha piu'' un nome file.',
            bad_idboll;
    end if;
end $$;

-- 2. idboll diventa obbligatorio: è l'unica fonte del nome file, oltre che la
--    chiave di aggancio del PDF. L'import ora rifiuta i nomi non canonici
--    (StandardCsvAdapter) invece di inserire bollette senza idboll.
alter table public.bills
    alter column idboll set not null;

-- 3. Via la colonna. Porta con sé bills_created_at_idx (vedi nota sopra).
alter table public.bills
    drop column if exists nome_pdf;

comment on column public.bills.idboll is
    'Numero bolletta. UNIQUE e NOT NULL. Doppio ruolo: chiave con cui l''import aggancia il PDF su R2 alla bolletta, e sorgente del nome file `<idboll>.pdf` (pdfNameForIdboll in src/lib/bill-pdf.ts). Ha sostituito nome_pdf_lower (20260831000000) e nome_pdf (questa migration).';

notify pgrst, 'reload schema';
