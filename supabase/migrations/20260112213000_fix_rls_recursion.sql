-- Create a security definer function to avoid infinite recursion
-- This function runs with the privileges of the creator (postgres) and bypasses RLS on thread_members
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

-- Drop old recursive policies
DROP POLICY IF EXISTS "Users can view threads they are members of" ON "public"."message_threads";
DROP POLICY IF EXISTS "Users can view thread members" ON "public"."thread_members";
DROP POLICY IF EXISTS "Users can join threads" ON "public"."thread_members";

-- Re-create Message Threads Policy using the helper function
CREATE POLICY "Users can view threads they are members of"
ON "public"."message_threads"
FOR SELECT
TO authenticated
USING (
    id IN (SELECT get_auth_user_threads())
);

-- Re-create Thread Members Policy using the helper function
CREATE POLICY "Users can view thread members"
ON "public"."thread_members"
FOR SELECT
TO authenticated
USING (
    thread_id IN (SELECT get_auth_user_threads())
);

-- Re-create Insert Policy for Thread Members
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
