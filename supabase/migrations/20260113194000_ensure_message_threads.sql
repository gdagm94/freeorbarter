-- Create message_threads table
CREATE TABLE IF NOT EXISTS "public"."message_threads" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "title" text,
    "item_id" uuid,
    "created_by" uuid REFERENCES "auth"."users"("id"),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."message_threads" OWNER TO "postgres";

-- Create thread_members table
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

-- Policies for message_threads
DROP POLICY IF EXISTS "Users can insert threads" ON "public"."message_threads";
CREATE POLICY "Users can insert threads" 
ON "public"."message_threads" 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can view threads they are members of" ON "public"."message_threads";
CREATE POLICY "Users can view threads they are members of" 
ON "public"."message_threads" 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.thread_members tm 
    WHERE tm.thread_id = id 
    AND tm.user_id = auth.uid()
  )
);

-- Policies for thread_members
DROP POLICY IF EXISTS "Users can view thread members" ON "public"."thread_members";
CREATE POLICY "Users can view thread members" 
ON "public"."thread_members" 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.thread_members tm 
    WHERE tm.thread_id = thread_id 
    AND tm.user_id = auth.uid()
  )
  OR user_id = auth.uid() -- Can see self-membership
);

DROP POLICY IF EXISTS "Users can join threads" ON "public"."thread_members";
CREATE POLICY "Users can join threads" 
ON "public"."thread_members" 
FOR INSERT 
TO authenticated 
WITH CHECK (
    user_id = auth.uid() OR 
    EXISTS ( -- Or if creator of thread adds them (logic handled by function usually, but good to have RLS backup)
         SELECT 1 FROM public.message_threads mt 
         WHERE mt.id = thread_id 
         AND mt.created_by = auth.uid()
    )
);

-- Grant permissions explicitly just in case
GRANT ALL ON TABLE "public"."message_threads" TO "anon";
GRANT ALL ON TABLE "public"."message_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_threads" TO "service_role";

GRANT ALL ON TABLE "public"."thread_members" TO "anon";
GRANT ALL ON TABLE "public"."thread_members" TO "authenticated";
GRANT ALL ON TABLE "public"."thread_members" TO "service_role";
