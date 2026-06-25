-- 20260625100000_bills_drop_cfpi.sql
-- Remove the redundant `cfpi` copy from bills.
--
-- The authoritative customer fiscal code lives on profiles.codice_fiscale /
-- partita_iva (profiles.cfpi was already dropped in 20260610100000). bills.cfpi
-- was only a redundant per-row copy used as a fallback in two places, both now
-- removed in code:
--   * register/actions.ts — identity is validated ONLY against the profile's
--     codice_fiscale / partita_iva (C-1 stays closed). The bills.cfpi and the
--     already-dead user_supplies.cfpi fallbacks are gone.
--   * payment-actions.ts — PagoPA debtor fiscal code comes from the profile;
--     any registered user necessarily has it set.
--
-- bills.cif / codice_cliente (100% populated) are unaffected.

ALTER TABLE public.bills DROP COLUMN IF EXISTS cfpi;

NOTIFY pgrst, 'reload schema';
