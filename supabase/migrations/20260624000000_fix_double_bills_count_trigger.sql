-- Fix profiles.bills_count showing double the real value.
--
-- Root cause: TWO triggers maintained the same denormalized counter, so every
-- INSERT incremented bills_count by 2 (and every DELETE decremented by 2):
--   bills:         tr_sync_bills_count -> sync_bills_count()      (redundant)
--                  trg_sync_bills_count -> sync_profile_counts()  (keep)
--   user_supplies: tr_sync_supplies_count -> sync_supplies_count()(redundant)
--                  trg_sync_supplies_count -> sync_profile_counts()(keep)
--
-- sync_profile_counts() is the complete implementation (INSERT/DELETE/UPDATE,
-- both tables, with relinking support), so we keep it and drop the duplicates.

-- 1. Remove the redundant triggers and their now-unused functions.
DROP TRIGGER IF EXISTS tr_sync_bills_count ON public.bills;
DROP TRIGGER IF EXISTS tr_sync_supplies_count ON public.user_supplies;
DROP FUNCTION IF EXISTS public.sync_bills_count();
DROP FUNCTION IF EXISTS public.sync_supplies_count();

-- 2. Recompute the denormalized counters from the source of truth.
UPDATE public.profiles p
SET bills_count = (SELECT count(*) FROM public.bills b WHERE b.user_id = p.id);

UPDATE public.profiles p
SET user_supplies_count = (SELECT count(*) FROM public.user_supplies s WHERE s.user_id = p.id);
