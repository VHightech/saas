-- 20260625110000_bills_readd_cfpi.sql
-- Reverts 20260625100000_bills_drop_cfpi.sql.
--
-- The column was dropped before the application code that stops inserting `cfpi`
-- was deployed. The live app still sends `cfpi` on every bill INSERT, so after
-- the drop those inserts failed ("column cfpi does not exist") — PDFs kept
-- uploading to R2 but no bill rows were created. Re-adding the column unblocks
-- imports immediately.
--
-- Sequencing for a clean future removal: deploy the updated code (which no longer
-- references bills.cfpi) FIRST, then drop the column.

ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS cfpi text;

NOTIFY pgrst, 'reload schema';
