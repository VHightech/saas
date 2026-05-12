-- Add bills_count and user_supplies_count to profiles table
-- and add triggers to keep them synchronized automatically.

-- 1. Ensure columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'bills_count'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN bills_count INT DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'user_supplies_count'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN user_supplies_count INT DEFAULT 0;
    END IF;
END $$;

-- 2. Initial synchronization
UPDATE public.profiles p
SET 
    bills_count = (SELECT COUNT(*) FROM public.bills b WHERE b.user_id = p.id),
    user_supplies_count = (SELECT COUNT(*) FROM public.user_supplies us WHERE us.user_id = p.id);

-- 3. Trigger function to update counts
CREATE OR REPLACE FUNCTION public.sync_profile_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'bills') THEN
            UPDATE public.profiles SET bills_count = bills_count + 1 WHERE id = NEW.user_id;
        ELSIF (TG_TABLE_NAME = 'user_supplies') THEN
            UPDATE public.profiles SET user_supplies_count = user_supplies_count + 1 WHERE id = NEW.user_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'bills') THEN
            UPDATE public.profiles SET bills_count = GREATEST(0, bills_count - 1) WHERE id = OLD.user_id;
        ELSIF (TG_TABLE_NAME = 'user_supplies') THEN
            UPDATE public.profiles SET user_supplies_count = GREATEST(0, user_supplies_count - 1) WHERE id = OLD.user_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle user_id changes (relinking)
        IF (OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
            IF (TG_TABLE_NAME = 'bills') THEN
                IF (OLD.user_id IS NOT NULL) THEN
                    UPDATE public.profiles SET bills_count = GREATEST(0, bills_count - 1) WHERE id = OLD.user_id;
                END IF;
                IF (NEW.user_id IS NOT NULL) THEN
                    UPDATE public.profiles SET bills_count = bills_count + 1 WHERE id = NEW.user_id;
                END IF;
            ELSIF (TG_TABLE_NAME = 'user_supplies') THEN
                IF (OLD.user_id IS NOT NULL) THEN
                    UPDATE public.profiles SET user_supplies_count = GREATEST(0, user_supplies_count - 1) WHERE id = OLD.user_id;
                END IF;
                IF (NEW.user_id IS NOT NULL) THEN
                    UPDATE public.profiles SET user_supplies_count = user_supplies_count + 1 WHERE id = NEW.user_id;
                END IF;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Triggers
DROP TRIGGER IF EXISTS trg_sync_bills_count ON public.bills;
CREATE TRIGGER trg_sync_bills_count
AFTER INSERT OR UPDATE OR DELETE ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_counts();

DROP TRIGGER IF EXISTS trg_sync_supplies_count ON public.user_supplies;
CREATE TRIGGER trg_sync_supplies_count
AFTER INSERT OR UPDATE OR DELETE ON public.user_supplies
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_counts();
