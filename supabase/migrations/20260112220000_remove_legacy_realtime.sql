-- Remove legacy function and its dependent triggers
-- This function was manually inserting into realtime.messages with a schema that is now outdated (missing 'extension' column)
-- The client now uses postgres_changes, so this logic is redundant and harmful.
DROP FUNCTION IF EXISTS public.forward_messages_to_realtime() CASCADE;
