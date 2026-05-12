-- Migration: 20260506070000_activation_helpers.sql
-- Description: Helpers for the simplified 'First Access' flow using only Codice Cliente.

-- Function to safely check for a client code and return a masked email
CREATE OR REPLACE FUNCTION public.check_activation_eligibility(p_codice_cliente TEXT)
RETURNS TABLE (
    exists BOOLEAN,
    has_email BOOLEAN,
    masked_email TEXT,
    email_exists_in_auth BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with high privileges to check auth table
AS $$
DECLARE
    v_email TEXT;
    v_auth_id UUID;
BEGIN
    -- 1. Find the profile
    SELECT email, id INTO v_email, v_auth_id
    FROM public.profiles
    WHERE codice_cliente = p_codice_cliente
    LIMIT 1;

    -- 2. If not found
    IF v_email IS NULL THEN
        RETURN QUERY SELECT FALSE, FALSE, ''::TEXT, FALSE;
        RETURN;
    END IF;

    -- 3. Mask the email (e.g. ma***@gmail.com)
    -- This gives the user a hint without exposing the full address
    RETURN QUERY SELECT 
        TRUE, 
        TRUE, 
        (regexp_replace(v_email, '^(..)(.*)(@.*)$', '\1***\3')),
        (v_auth_id IS NOT NULL);
END;
$$;
