-- Add stadio and stato_contratto to user_supplies table
-- This allows tracking the contract status for each specific supply point (utenza)
-- as requested by the admin for large accounts with multiple service points.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_supplies' AND column_name = 'stadio'
    ) THEN
        ALTER TABLE public.user_supplies ADD COLUMN stadio TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_supplies' AND column_name = 'stato_contratto'
    ) THEN
        ALTER TABLE public.user_supplies ADD COLUMN stato_contratto TEXT;
    END IF;
END $$;
