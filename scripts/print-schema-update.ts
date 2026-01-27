console.log(`
-- Run this in the Supabase SQL Editor to update the profiles table

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS city text;

-- Optional: Comments for clarity
COMMENT ON COLUMN public.profiles.address IS 'Full address from CSV (indirizzo utenza)';
COMMENT ON COLUMN public.profiles.city IS 'City/Municipality (Comune)';
`);
