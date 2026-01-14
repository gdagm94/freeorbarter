-- Force recreation of message tables and secure policies

-- Ensure tables exist
CREATE TABLE IF NOT EXISTS "public"."message_threads" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "title" text,
    "item_id" uuid,
    "created_by" uuid REFERENCES "auth"."users"("id"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- Check if owner is correct, if not grant it (optional, but good practice)
ALTER TABLE "public"."message_threads" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."thread_members" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "thread_id" uuid REFERENCES "public"."message_threads"("id") ON DELETE CASCADE,
    "user_id" uuid REFERENCES "auth"."users"("id"),
    "role" text DEFAULT 'member'::text,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "thread_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "thread_members_thread_id_user_id_key" UNIQUE ("thread_id", "user_id")
);

ALTER TABLE "public"."thread_members" OWNER TO "postgres";

-- Enable RLS
ALTER TABLE "public"."message_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."thread_members" ENABLE ROW LEVEL SECURITY;

-- Create helper function if not exists
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

-- Drop ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can insert threads" ON "public"."message_threads";
DROP POLICY IF EXISTS "Users can view threads they are members of" ON "public"."message_threads";
DROP POLICY IF EXISTS "Users can view thread members" ON "public"."thread_members";
DROP POLICY IF EXISTS "Users can join threads" ON "public"."thread_members";
DROP POLICY IF EXISTS "Users can insert thread members" ON "public"."thread_members";

-- Re-apply policies
CREATE POLICY "Users can insert threads" 
ON "public"."message_threads" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view threads they are members of"
ON "public"."message_threads"
FOR SELECT
TO authenticated
USING (
    id IN (SELECT get_auth_user_threads())
);

CREATE POLICY "Users can view thread members"
ON "public"."thread_members"
FOR SELECT
TO authenticated
USING (
    thread_id IN (SELECT get_auth_user_threads())
);

CREATE POLICY "Users can insert thread members"
ON "public"."thread_members"
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
    OR
    thread_id IN (SELECT get_auth_user_threads())
    OR
    EXISTS (
        SELECT 1 FROM message_threads
        WHERE id = thread_id AND created_by = auth.uid()
    )
);

-- Grants
GRANT ALL ON TABLE "public"."message_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_members" TO "authenticated";
GRANT ALL ON TABLE "public"."message_threads" TO "service_role";
GRANT ALL ON TABLE "public"."thread_members" TO "service_role";
GRANT EXECUTE ON FUNCTION get_auth_user_threads TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_threads TO service_role;
