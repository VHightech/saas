-- Migration: 20260204090000_cleanup_legacy_columns.sql
-- Description: Drops legacy columns from profiles and bills tables.

-- 1. Drop `legacy_id` from `profiles` if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'legacy_id') THEN
        ALTER TABLE profiles DROP COLUMN legacy_id;
    END IF;
END $$;

-- 2. Drop `legacy_user_id` from `bills` if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'legacy_user_id') THEN
        ALTER TABLE bills DROP COLUMN legacy_user_id;
    END IF;
END $$;

-- 3. Drop `codice_cliente_old` from `profiles` OR `bills` (checking both just in case)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'codice_cliente_old') THEN
        ALTER TABLE bills DROP COLUMN codice_cliente_old;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'codice_cliente_old') THEN
        ALTER TABLE profiles DROP COLUMN codice_cliente_old;
    END IF;
END $$;
