-- Fix infinite recursion in RLS policies by using a SECURITY DEFINER function

-- 1. Create or replace the helper function to bypass RLS
CREATE OR REPLACE FUNCTION get_auth_user_threads()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT thread_id
    FROM thread_members
    WHERE user_id = auth.uid()
$$;

ALTER FUNCTION get_auth_user_threads() OWNER TO postgres;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Users can view threads they are members of" ON "public"."message_threads";
DROP POLICY IF EXISTS "Users can view thread members" ON "public"."thread_members";
DROP POLICY IF EXISTS "Users can join threads" ON "public"."thread_members";
DROP POLICY IF EXISTS "Users can insert thread members" ON "public"."thread_members";

-- 3. Re-create Message Threads Policy
CREATE POLICY "Users can view threads they are members of"
ON "public"."message_threads"
FOR SELECT
TO authenticated
USING (
    id IN (SELECT get_auth_user_threads())
);

-- 4. Re-create Thread Members Policy
CREATE POLICY "Users can view thread members"
ON "public"."thread_members"
FOR SELECT
TO authenticated
USING (
    thread_id IN (SELECT get_auth_user_threads())
);

-- 5. Re-create Insert Policy for Thread Members
CREATE POLICY "Users can insert thread members"
ON "public"."thread_members"
FOR INSERT
TO authenticated
WITH CHECK (
    -- User adding themselves
    user_id = auth.uid()
    OR
    -- User is already a member of the thread (e.g. inviting others)
    thread_id IN (SELECT get_auth_user_threads())
    OR
    -- User created the thread (and is adding the first members)
    EXISTS (
        SELECT 1 FROM message_threads
        WHERE id = thread_id AND created_by = auth.uid()
    )
);

-- 6. Grant permissions (just to be safe)
GRANT EXECUTE ON FUNCTION get_auth_user_threads TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_threads TO service_role;
