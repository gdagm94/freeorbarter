drop policy "Users can create reports" on "public"."reported_messages";

drop policy "Users can view their reports" on "public"."reported_messages";

drop policy "Moderators can view all reports" on "public"."reports";

drop policy "Users can create blocks" on "public"."blocked_users";

drop policy "Users can remove blocks" on "public"."blocked_users";

drop policy "Users can view their blocks" on "public"."blocked_users";

drop policy "Users can create dismissals" on "public"."changelog_dismissals";

drop policy "Users can view their own dismissals" on "public"."changelog_dismissals";

drop policy "Moderators can view all filter logs" on "public"."content_filter_logs";

drop policy "Users can view their own filter logs" on "public"."content_filter_logs";

drop policy "Users can delete their own pending requests" on "public"."friend_requests";

drop policy "Users can send friend requests" on "public"."friend_requests";

drop policy "Users can update received requests" on "public"."friend_requests";

drop policy "Users can view their own friend requests" on "public"."friend_requests";

drop policy "Users can delete their friendships" on "public"."friendships";

drop policy "Users can view their friendships" on "public"."friendships";

drop policy "Users can create items" on "public"."items";

drop policy "Users can delete own items" on "public"."items";

drop policy "Users can update own items" on "public"."items";

drop policy "Users can send messages" on "public"."messages";

drop policy "Users can view their messages" on "public"."messages";

drop policy "Moderators can view all moderation actions" on "public"."moderation_actions";

drop policy "Users can delete their own notification settings" on "public"."notification_settings";

drop policy "Users can insert their own notification settings" on "public"."notification_settings";

drop policy "Users can update their own notification settings" on "public"."notification_settings";

drop policy "Users can view their own notification settings" on "public"."notification_settings";

drop policy "Moderators can update reports" on "public"."reports";

drop policy "Reporters can view their reports" on "public"."reports";

drop policy "Users can create reports" on "public"."reports";

drop policy "Users insert their policy acceptance" on "public"."user_policy_acceptances";

drop policy "Users select own policy acceptance" on "public"."user_policy_acceptances";

drop policy "Users can update own profile" on "public"."users";

drop policy "Users can add watched items" on "public"."watched_items";

drop policy "Users can remove watched items" on "public"."watched_items";

drop policy "Users can view their watched items" on "public"."watched_items";

drop index if exists "public"."blocked_keywords_keyword_idx";

drop index if exists "public"."changelog_dismissals_changelog_id_idx";

drop index if exists "public"."content_filter_logs_action_idx";

drop index if exists "public"."content_filter_logs_content_idx";

drop index if exists "public"."content_filter_logs_user_idx";

drop index if exists "public"."friend_requests_status_idx";

drop index if exists "public"."items_category_idx";

drop index if exists "public"."items_status_idx";

drop index if exists "public"."items_type_idx";

drop index if exists "public"."messages_archived_idx";

drop index if exists "public"."messages_is_offer_idx";

drop index if exists "public"."moderation_actions_moderator_idx";

drop index if exists "public"."moderation_actions_report_idx";

drop index if exists "public"."moderation_actions_target_idx";

drop index if exists "public"."moderation_actions_type_idx";

drop index if exists "public"."newsletter_subscribers_email_idx";

drop index if exists "public"."notifications_created_at_idx";

drop index if exists "public"."notifications_read_idx";

drop index if exists "public"."notifications_sender_id_idx";

drop index if exists "public"."notifications_type_idx";

drop index if exists "public"."reported_messages_message_id_idx";

drop index if exists "public"."reports_auto_escalated_idx";

drop index if exists "public"."reports_needs_action_idx";

drop index if exists "public"."reports_reporter_idx";

drop index if exists "public"."reports_resolved_at_idx";

drop index if exists "public"."reports_resolved_by_idx";

drop index if exists "public"."reports_status_idx";

drop index if exists "public"."reports_target_idx";

drop index if exists "public"."user_policy_latest_idx";

drop index if exists "public"."users_banned_idx";

drop index if exists "public"."users_username_idx";

alter type "public"."history_action_type" rename to "history_action_type__old_version_to_be_dropped";

create type "public"."history_action_type" as enum ('created', 'edited', 'deleted');


  create table "public"."barter_offers" (
    "id" uuid not null default gen_random_uuid(),
    "sender_id" uuid not null,
    "receiver_id" uuid not null,
    "offered_item_id" uuid not null,
    "requested_item_id" uuid not null,
    "message" text not null,
    "status" text not null default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "expiration_date" timestamp with time zone,
    "template_id" uuid,
    "parent_offer_id" uuid
      );


alter table "public"."barter_offers" enable row level security;


  create table "public"."counter_offers" (
    "id" uuid not null default gen_random_uuid(),
    "original_offer_id" uuid not null,
    "counter_offer_id" uuid not null,
    "message" text,
    "status" text default 'pending'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."counter_offers" enable row level security;


  create table "public"."message_files" (
    "id" uuid not null default gen_random_uuid(),
    "message_id" uuid not null,
    "file_url" text not null,
    "file_name" text not null,
    "file_type" text not null,
    "file_size" bigint,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."message_files" enable row level security;


  create table "public"."message_reactions" (
    "id" uuid not null default gen_random_uuid(),
    "message_id" uuid not null,
    "user_id" uuid not null,
    "emoji" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."message_reactions" enable row level security;


  create table "public"."message_threads" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "item_id" uuid,
    "created_by" uuid not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "is_active" boolean default true
      );


alter table "public"."message_threads" enable row level security;


  create table "public"."offer_expirations" (
    "id" uuid not null default gen_random_uuid(),
    "offer_id" uuid not null,
    "expires_at" timestamp with time zone not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."offer_expirations" enable row level security;


  create table "public"."offer_templates" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null,
    "content" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."offer_templates" enable row level security;


  create table "public"."push_settings" (
    "id" text not null default 'singleton'::text,
    "functions_endpoint" text not null,
    "service_role_key" text not null,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."push_settings" enable row level security;


  create table "public"."thread_members" (
    "id" uuid not null default gen_random_uuid(),
    "thread_id" uuid not null,
    "user_id" uuid not null,
    "role" text default 'member'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."thread_members" enable row level security;


  create table "public"."user_history" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "action_type" public.history_action_type not null,
    "item_id" uuid,
    "item_title" text not null,
    "item_description" text,
    "item_images" text[],
    "item_category" text,
    "item_condition" public.item_condition,
    "item_type" public.listing_type,
    "changes" jsonb,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."user_history" enable row level security;

drop type "public"."history_action_type__old_version_to_be_dropped";

alter table "public"."account_deletion_audit" enable row level security;

alter table "public"."messages" add column "file_url" text;

alter table "public"."messages" add column "image_url" text;

alter table "public"."messages" add column "read_at" timestamp with time zone;

alter table "public"."messages" add column "thread_id" uuid;

alter table "public"."messages" add column "topic" text not null default 'direct'::text;

CREATE UNIQUE INDEX barter_offers_pkey ON public.barter_offers USING btree (id);

CREATE UNIQUE INDEX counter_offers_pkey ON public.counter_offers USING btree (id);

CREATE INDEX idx_barter_offers_offered_item_id ON public.barter_offers USING btree (offered_item_id);

CREATE INDEX idx_barter_offers_requested_item_id ON public.barter_offers USING btree (requested_item_id);

CREATE INDEX idx_barter_offers_status ON public.barter_offers USING btree (status);

CREATE INDEX idx_content_filter_logs_matched_keyword_id ON public.content_filter_logs USING btree (matched_keyword_id);

CREATE INDEX idx_message_threads_created_by ON public.message_threads USING btree (created_by);

CREATE INDEX idx_thread_members_thread_user ON public.thread_members USING btree (thread_id, user_id);

CREATE INDEX idx_user_history_item_id ON public.user_history USING btree (item_id);

CREATE INDEX idx_user_policy_acceptances_policy_id ON public.user_policy_acceptances USING btree (policy_id);

CREATE UNIQUE INDEX message_files_pkey ON public.message_files USING btree (id);

CREATE INDEX message_reactions_message_id_idx ON public.message_reactions USING btree (message_id);

CREATE UNIQUE INDEX message_reactions_message_id_user_id_emoji_key ON public.message_reactions USING btree (message_id, user_id, emoji);

CREATE UNIQUE INDEX message_reactions_pkey ON public.message_reactions USING btree (id);

CREATE INDEX message_reactions_user_id_idx ON public.message_reactions USING btree (user_id);

CREATE INDEX message_threads_created_by_idx ON public.message_threads USING btree (created_by);

CREATE INDEX message_threads_is_active_idx ON public.message_threads USING btree (is_active);

CREATE INDEX message_threads_item_id_idx ON public.message_threads USING btree (item_id);

CREATE UNIQUE INDEX message_threads_pkey ON public.message_threads USING btree (id);

CREATE INDEX messages_thread_id_idx ON public.messages USING btree (thread_id);

CREATE UNIQUE INDEX offer_expirations_pkey ON public.offer_expirations USING btree (id);

CREATE UNIQUE INDEX offer_templates_pkey ON public.offer_templates USING btree (id);

CREATE INDEX offer_templates_user_id_idx ON public.offer_templates USING btree (user_id);

CREATE UNIQUE INDEX push_settings_pkey ON public.push_settings USING btree (id);

CREATE UNIQUE INDEX thread_members_pkey ON public.thread_members USING btree (id);

CREATE UNIQUE INDEX thread_members_thread_id_user_id_key ON public.thread_members USING btree (thread_id, user_id);

CREATE UNIQUE INDEX user_history_pkey ON public.user_history USING btree (id);

CREATE INDEX user_history_user_action_idx ON public.user_history USING btree (user_id, action_type);

alter table "public"."barter_offers" add constraint "barter_offers_pkey" PRIMARY KEY using index "barter_offers_pkey";

alter table "public"."counter_offers" add constraint "counter_offers_pkey" PRIMARY KEY using index "counter_offers_pkey";

alter table "public"."message_files" add constraint "message_files_pkey" PRIMARY KEY using index "message_files_pkey";

alter table "public"."message_reactions" add constraint "message_reactions_pkey" PRIMARY KEY using index "message_reactions_pkey";

alter table "public"."message_threads" add constraint "message_threads_pkey" PRIMARY KEY using index "message_threads_pkey";

alter table "public"."offer_expirations" add constraint "offer_expirations_pkey" PRIMARY KEY using index "offer_expirations_pkey";

alter table "public"."offer_templates" add constraint "offer_templates_pkey" PRIMARY KEY using index "offer_templates_pkey";

alter table "public"."push_settings" add constraint "push_settings_pkey" PRIMARY KEY using index "push_settings_pkey";

alter table "public"."thread_members" add constraint "thread_members_pkey" PRIMARY KEY using index "thread_members_pkey";

alter table "public"."user_history" add constraint "user_history_pkey" PRIMARY KEY using index "user_history_pkey";

alter table "public"."barter_offers" add constraint "barter_offers_offered_item_id_fkey" FOREIGN KEY (offered_item_id) REFERENCES public.items(id) ON DELETE CASCADE not valid;

alter table "public"."barter_offers" validate constraint "barter_offers_offered_item_id_fkey";

alter table "public"."barter_offers" add constraint "barter_offers_parent_offer_id_fkey" FOREIGN KEY (parent_offer_id) REFERENCES public.barter_offers(id) ON DELETE CASCADE not valid;

alter table "public"."barter_offers" validate constraint "barter_offers_parent_offer_id_fkey";

alter table "public"."barter_offers" add constraint "barter_offers_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."barter_offers" validate constraint "barter_offers_receiver_id_fkey";

alter table "public"."barter_offers" add constraint "barter_offers_requested_item_id_fkey" FOREIGN KEY (requested_item_id) REFERENCES public.items(id) ON DELETE CASCADE not valid;

alter table "public"."barter_offers" validate constraint "barter_offers_requested_item_id_fkey";

alter table "public"."barter_offers" add constraint "barter_offers_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."barter_offers" validate constraint "barter_offers_sender_id_fkey";

alter table "public"."barter_offers" add constraint "barter_offers_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text]))) not valid;

alter table "public"."barter_offers" validate constraint "barter_offers_status_check";

alter table "public"."counter_offers" add constraint "counter_offers_counter_offer_id_fkey" FOREIGN KEY (counter_offer_id) REFERENCES public.barter_offers(id) ON DELETE CASCADE not valid;

alter table "public"."counter_offers" validate constraint "counter_offers_counter_offer_id_fkey";

alter table "public"."counter_offers" add constraint "counter_offers_original_offer_id_fkey" FOREIGN KEY (original_offer_id) REFERENCES public.barter_offers(id) ON DELETE CASCADE not valid;

alter table "public"."counter_offers" validate constraint "counter_offers_original_offer_id_fkey";

alter table "public"."counter_offers" add constraint "counter_offers_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text]))) not valid;

alter table "public"."counter_offers" validate constraint "counter_offers_status_check";

alter table "public"."message_files" add constraint "message_files_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE not valid;

alter table "public"."message_files" validate constraint "message_files_message_id_fkey";

alter table "public"."message_reactions" add constraint "message_reactions_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE not valid;

alter table "public"."message_reactions" validate constraint "message_reactions_message_id_fkey";

alter table "public"."message_reactions" add constraint "message_reactions_message_id_user_id_emoji_key" UNIQUE using index "message_reactions_message_id_user_id_emoji_key";

alter table "public"."message_reactions" add constraint "message_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."message_reactions" validate constraint "message_reactions_user_id_fkey";

alter table "public"."message_threads" add constraint "message_threads_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."message_threads" validate constraint "message_threads_created_by_fkey";

alter table "public"."message_threads" add constraint "message_threads_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE not valid;

alter table "public"."message_threads" validate constraint "message_threads_item_id_fkey";

alter table "public"."messages" add constraint "fk_messages_thread_id" FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "fk_messages_thread_id";

alter table "public"."offer_expirations" add constraint "offer_expirations_offer_id_fkey" FOREIGN KEY (offer_id) REFERENCES public.barter_offers(id) ON DELETE CASCADE not valid;

alter table "public"."offer_expirations" validate constraint "offer_expirations_offer_id_fkey";

alter table "public"."offer_templates" add constraint "offer_templates_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."offer_templates" validate constraint "offer_templates_user_id_fkey";

alter table "public"."thread_members" add constraint "thread_members_thread_id_user_id_key" UNIQUE using index "thread_members_thread_id_user_id_key";

alter table "public"."user_history" add constraint "user_history_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL not valid;

alter table "public"."user_history" validate constraint "user_history_item_id_fkey";

alter table "public"."user_history" add constraint "user_history_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_history" validate constraint "user_history_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.add_thread_member(p_thread_id uuid, p_user_id uuid, p_role text DEFAULT 'member'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_creator uuid;
  v_exists boolean;
BEGIN
  -- Check thread exists and get creator
  SELECT created_by INTO v_creator FROM public.message_threads WHERE id = p_thread_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','thread_not_found');
  END IF;

  -- permission: allow if caller is thread creator or member with role 'admin' or caller equals p_user_id (self-join)
  -- Use auth.uid() for caller
  IF (SELECT COALESCE((SELECT (auth.uid()) IS NOT NULL), FALSE) ) IS NULL THEN
    -- auth.uid() may be null in some contexts; allow only service role then
    NULL; -- continue, SECURITY DEFINER used; rely on caller context
  END IF;

  -- Check permission: caller must be creator OR member with admin role OR adding themselves
  IF (SELECT auth.uid())::text IS NOT NULL THEN
    IF (SELECT auth.uid()::uuid) <> v_creator AND NOT EXISTS (
      SELECT 1 FROM public.thread_members tm WHERE tm.thread_id = p_thread_id AND tm.user_id = (SELECT auth.uid()) AND tm.role = 'admin'
    ) AND (SELECT auth.uid())::uuid <> p_user_id THEN
      RETURN jsonb_build_object('status','error','message','forbidden');
    END IF;
  END IF;

  -- Insert idempotent
  SELECT EXISTS(SELECT 1 FROM public.thread_members WHERE thread_id = p_thread_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('status','ok','message','already_member');
  END IF;

  INSERT INTO public.thread_members(thread_id, user_id, role) VALUES (p_thread_id, p_user_id, p_role);
  RETURN jsonb_build_object('status','ok','message','added');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_offers()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- Update expired offers
  UPDATE barter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND expiration_date IS NOT NULL 
  AND expiration_date < now();
  
  -- Update expired counter offers
  UPDATE counter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND EXISTS (
    SELECT 1 FROM barter_offers 
    WHERE barter_offers.id = counter_offers.original_offer_id 
    AND barter_offers.status = 'expired'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.forward_messages_to_realtime()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO realtime.messages(topic, payload, "event")
    VALUES (
      'room:' || NEW.thread_id::text || ':messages',
      to_jsonb(NEW),
      'INSERT'
    );
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_item_owner(item_uuid uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT user_id FROM public.items WHERE id = $1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_thread(participant_uuids uuid[], item_id uuid DEFAULT NULL::uuid, title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  normalized uuid[] := (SELECT ARRAY(SELECT DISTINCT unnest(participant_uuids)));
  participants_count int := array_length(normalized,1);
  existing_thread uuid;
  new_thread uuid := gen_random_uuid();
BEGIN
  IF participants_count IS NULL OR participants_count < 2 THEN
    RAISE EXCEPTION 'participant_uuids must contain at least 2 distinct uuids';
  END IF;

  -- Try to find an existing thread with same set of participants and same item_id (if provided)
  SELECT mt.id INTO existing_thread
  FROM public.message_threads mt
  WHERE (
    (item_id IS NULL AND $2 IS NULL) OR (mt.item_id = $2)
  )
  AND (
    -- participants match: count of members equals and all members present
    (SELECT COUNT(DISTINCT tm.user_id) FROM public.thread_members tm WHERE tm.thread_id = mt.id) = participants_count
    AND NOT EXISTS (
      SELECT 1 FROM (
        SELECT unnest(normalized) AS u
      ) p
      WHERE NOT EXISTS (
        SELECT 1 FROM public.thread_members tm2 WHERE tm2.thread_id = mt.id AND tm2.user_id = p.u
      )
    )
  )
  LIMIT 1;

  IF existing_thread IS NOT NULL THEN
    RETURN existing_thread;
  END IF;

  -- Create thread
  INSERT INTO public.message_threads(id, title, item_id, created_by, created_at, updated_at)
  VALUES (new_thread, title, item_id, auth.uid(), now(), now());

  -- Insert members
  INSERT INTO public.thread_members(id, thread_id, user_id, created_at)
  SELECT gen_random_uuid(), new_thread, u, now() FROM unnest(normalized) AS u;

  RETURN new_thread;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_thread_members(p_thread_id uuid)
 RETURNS TABLE(id uuid, thread_id uuid, user_id uuid, role text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT id, thread_id, user_id, role, created_at FROM public.thread_members WHERE thread_id = p_thread_id ORDER BY created_at;
$function$
;

CREATE OR REPLACE FUNCTION public.is_thread_member(_user uuid, _thread uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.thread_members tm
    WHERE tm.user_id = _user AND tm.thread_id = _thread
  );
$function$
;

CREATE OR REPLACE FUNCTION public.messages_broadcast_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM realtime.broadcast_changes(
    'room:' || COALESCE(NEW.thread_id, OLD.thread_id)::text || ':messages',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_thread_member(p_thread_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_creator uuid;
BEGIN
  SELECT created_by INTO v_creator FROM public.message_threads WHERE id = p_thread_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','error','message','thread_not_found');
  END IF;

  -- permission: allow if caller is thread creator OR member with admin role OR removing themselves
  IF (SELECT auth.uid())::text IS NOT NULL THEN
    IF (SELECT auth.uid()::uuid) <> v_creator AND NOT EXISTS (
      SELECT 1 FROM public.thread_members tm WHERE tm.thread_id = p_thread_id AND tm.user_id = (SELECT auth.uid()) AND tm.role = 'admin'
    ) AND (SELECT auth.uid())::uuid <> p_user_id THEN
      RETURN jsonb_build_object('status','error','message','forbidden');
    END IF;
  END IF;

  DELETE FROM public.thread_members WHERE thread_id = p_thread_id AND user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status','ok','message','removed');
  ELSE
    RETURN jsonb_build_object('status','ok','message','not_found');
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_message_thread_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- If created_by is not provided, set it to the current authenticated user's uid
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO user_history (
    user_id,
    action_type,
    item_id,
    item_title,
    item_description,
    item_images,
    item_category,
    item_condition,
    item_type
  ) VALUES (
    NEW.user_id,
    'created',
    NEW.id,
    NEW.title,
    NEW.description,
    NEW.images,
    NEW.category,
    NEW.condition,
    NEW.type
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO user_history (
    user_id,
    action_type,
    item_id, -- This will be NULL since item is deleted
    item_title,
    item_description,
    item_images,
    item_category,
    item_condition,
    item_type
  ) VALUES (
    OLD.user_id,
    'deleted',
    NULL,
    OLD.title,
    OLD.description,
    OLD.images,
    OLD.category,
    OLD.condition,
    OLD.type
  );
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_item_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  changes_json jsonb := '{}';
BEGIN
  -- Track changes in a JSON object
  IF OLD.title != NEW.title THEN
    changes_json := changes_json || jsonb_build_object('title', jsonb_build_object('old', OLD.title, 'new', NEW.title));
  END IF;
  
  IF OLD.description != NEW.description THEN
    changes_json := changes_json || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
  END IF;
  
  IF OLD.images != NEW.images THEN
    changes_json := changes_json || jsonb_build_object('images', jsonb_build_object('old', OLD.images, 'new', NEW.images));
  END IF;
  
  IF OLD.category != NEW.category THEN
    changes_json := changes_json || jsonb_build_object('category', jsonb_build_object('old', OLD.category, 'new', NEW.category));
  END IF;
  
  IF OLD.condition != NEW.condition THEN
    changes_json := changes_json || jsonb_build_object('condition', jsonb_build_object('old', OLD.condition, 'new', NEW.condition));
  END IF;
  
  IF OLD.type != NEW.type THEN
    changes_json := changes_json || jsonb_build_object('type', jsonb_build_object('old', OLD.type, 'new', NEW.type));
  END IF;
  
  IF OLD.location != NEW.location THEN
    changes_json := changes_json || jsonb_build_object('location', jsonb_build_object('old', OLD.location, 'new', NEW.location));
  END IF;

  -- Only insert history record if there were actual changes
  IF changes_json != '{}' THEN
    INSERT INTO user_history (
      user_id,
      action_type,
      item_id,
      item_title,
      item_description,
      item_images,
      item_category,
      item_condition,
      item_type,
      changes
    ) VALUES (
      NEW.user_id,
      'edited',
      NEW.id,
      NEW.title,
      NEW.description,
      NEW.images,
      NEW.category,
      NEW.condition,
      NEW.type,
      changes_json
    );
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_message_read_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- Only update read_at if read is being set to true and read_at is null
  IF NEW.read = true AND OLD.read = false AND NEW.read_at IS NULL THEN
    NEW.read_at = now();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_template_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_thread_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  IF NEW.thread_id IS NOT NULL THEN
    UPDATE message_threads 
    SET updated_at = now() 
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_direct_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  sender_username text;
  message_preview text;
BEGIN
  -- Only process direct messages (item_id is null)
  IF NEW.item_id IS NULL THEN
    -- Get sender's username
    SELECT username INTO sender_username
    FROM users
    WHERE id = NEW.sender_id;

    -- Create message preview (max 50 chars)
    message_preview := CASE 
      WHEN length(NEW.content) > 50 THEN substring(NEW.content from 1 for 47) || '...'
      ELSE NEW.content
    END;

    -- Insert notification for receiver
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      NEW.receiver_id,
      NEW.sender_id,
      'direct_message',
      COALESCE(sender_username, 'Someone') || ': ' || message_preview,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  sender_username text;
BEGIN
  -- Get sender's username
  SELECT username INTO sender_username
  FROM users
  WHERE id = NEW.sender_id;

  -- Insert notification for receiver
  INSERT INTO notifications (user_id, sender_id, type, content, related_id)
  VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'friend_request',
    COALESCE(sender_username, 'Someone') || ' has requested to follow you',
    NEW.id
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_friend_request_accepted()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  receiver_username text;
BEGIN
  -- Only process if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Get receiver's username
    SELECT username INTO receiver_username
    FROM users
    WHERE id = NEW.receiver_id;

    -- Insert notification for original sender
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      NEW.sender_id,
      NEW.receiver_id,
      'friend_request_approved',
      COALESCE(receiver_username, 'Someone') || ' has approved your friend request',
      NEW.receiver_id
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_new_listing_from_friend()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  friend_record RECORD;
  poster_username text;
BEGIN
  -- Get poster's username
  SELECT username INTO poster_username
  FROM users
  WHERE id = NEW.user_id;

  -- Find all friends of the item poster and create notifications
  FOR friend_record IN
    SELECT CASE 
      WHEN user1_id = NEW.user_id THEN user2_id
      ELSE user1_id
    END as friend_id
    FROM friendships
    WHERE user1_id = NEW.user_id OR user2_id = NEW.user_id
  LOOP
    -- Insert notification for each friend
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      friend_record.friend_id,
      NEW.user_id,
      'new_listing',
      COALESCE(poster_username, 'Someone') || ' just posted: ' || COALESCE(NEW.title, 'a new item'),
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification_on_watchlist_add()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  watcher_username text;
  item_title text;
  item_owner_id uuid;
BEGIN
  -- Get watcher's username
  SELECT username INTO watcher_username
  FROM users
  WHERE id = NEW.user_id;

  -- Get item details
  SELECT title, user_id INTO item_title, item_owner_id
  FROM items
  WHERE id = NEW.item_id;

  -- Only create notification if someone else is watching the item (not the owner)
  IF NEW.user_id != item_owner_id THEN
    -- Insert notification for item owner
    INSERT INTO notifications (user_id, sender_id, type, content, related_id)
    VALUES (
      item_owner_id,
      NEW.user_id,
      'watchlist_update',
      COALESCE(watcher_username, 'Someone') || ' added ' || COALESCE(item_title, 'an item') || ' to their watchlist',
      NEW.item_id
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_user_account_data(target_user_id uuid, target_email text DEFAULT NULL::text, metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
cleaned_metadata jsonb := COALESCE(metadata, '{}'::jsonb);
BEGIN
IF target_user_id IS NULL THEN
RAISE EXCEPTION 'target_user_id must be provided';
END IF;

INSERT INTO account_deletion_audit (user_id, email, metadata)
VALUES (target_user_id, target_email, cleaned_metadata)
ON CONFLICT (user_id) DO UPDATE
SET deleted_at = now(),
email = COALESCE(EXCLUDED.email, account_deletion_audit.email),
metadata = account_deletion_audit.metadata || EXCLUDED.metadata;

-- Defensive clean-up for tables that may not cascade automatically
IF to_regclass('public.notification_settings') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.notification_settings WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.offer_templates') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.offer_templates WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.changelog_dismissals') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.changelog_dismissals WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.reported_messages') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.reported_messages WHERE reporter_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.message_reactions') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.message_reactions WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.barter_offers') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'barter_offers'
AND column_name = 'sender_id'
) THEN
EXECUTE 'DELETE FROM public.barter_offers WHERE sender_id = $1'
USING target_user_id;
END IF;

IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'barter_offers'
AND column_name = 'receiver_id'
) THEN
EXECUTE 'DELETE FROM public.barter_offers WHERE receiver_id = $1'
USING target_user_id;
END IF;

IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'barter_offers'
AND column_name = 'requested_item_owner_id'
) THEN
EXECUTE 'DELETE FROM public.barter_offers WHERE requested_item_owner_id = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.counter_offers') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'counter_offers'
AND column_name = 'created_by'
) THEN
EXECUTE 'DELETE FROM public.counter_offers WHERE created_by = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.notifications') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
AND column_name = 'sender_id'
) THEN
EXECUTE 'DELETE FROM public.notifications WHERE sender_id = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.friend_requests') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.friend_requests WHERE sender_id = $1 OR receiver_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.friendships') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.friendships WHERE user1_id = $1 OR user2_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.blocked_users') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.blocked_users WHERE blocker_id = $1 OR blocked_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.notifications') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'notifications'
AND column_name = 'user_id'
) THEN
EXECUTE 'DELETE FROM public.notifications WHERE user_id = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.watched_items') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.watched_items WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.message_threads') IS NOT NULL THEN
IF EXISTS (
SELECT 1 FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'message_threads'
AND column_name = 'created_by'
) THEN
EXECUTE 'DELETE FROM public.message_threads WHERE created_by = $1'
USING target_user_id;
END IF;
END IF;

IF to_regclass('public.messages') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.messages WHERE sender_id = $1 OR receiver_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.items') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.items WHERE user_id = $1'
USING target_user_id;
END IF;

IF to_regclass('public.user_history') IS NOT NULL THEN
EXECUTE 'DELETE FROM public.user_history WHERE user_id = $1'
USING target_user_id;
END IF;

-- Finally remove the profile row (cascades handle remaining relations)
DELETE FROM users WHERE id = target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_accepted_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- Only process if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Insert friendship with consistent ordering (smaller UUID first)
    INSERT INTO friendships (user1_id, user2_id)
    VALUES (
      LEAST(NEW.sender_id, NEW.receiver_id),
      GREATEST(NEW.sender_id, NEW.receiver_id)
    )
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
    
    -- Delete the friend request
    DELETE FROM friend_requests WHERE id = NEW.id;
    
    -- Return NULL to prevent the original UPDATE
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_message_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  -- For new messages
  IF TG_OP = 'INSERT' THEN
    -- Set default values for new messages
    NEW.read := FALSE;
    RETURN NEW;
  
  -- For message updates
  ELSIF TG_OP = 'UPDATE' THEN
    -- If read status is being changed
    IF NEW.read IS DISTINCT FROM OLD.read THEN
      -- Ensure read timestamp is set when message is marked as read
      IF NEW.read = TRUE THEN
        NEW.read := TRUE;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    gender,
    profile_completed,
    created_at
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    (CASE 
      WHEN new.raw_user_meta_data->>'gender' = 'male' THEN 'male'::user_gender
      WHEN new.raw_user_meta_data->>'gender' = 'female' THEN 'female'::user_gender
      ELSE NULL
    END),
    false,
    COALESCE(new.created_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    gender = EXCLUDED.gender,
    profile_completed = EXCLUDED.profile_completed;

  RETURN new;
EXCEPTION
  WHEN others THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_push_for_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  fn_endpoint text;
  service_role_key text;
  payload jsonb;
  request_id bigint;
begin
  -- Read from settings table instead of config
  select 
    functions_endpoint,
    push_settings.service_role_key
  into fn_endpoint, service_role_key
  from public.push_settings
  where id = 'singleton';

  if fn_endpoint is null or service_role_key is null then
    raise warning 'send_push_for_notification: missing settings in push_settings table';
    return new;
  end if;

  payload := jsonb_build_object(
    'user_id', new.user_id,
    'title', coalesce(new.type::text, 'Notification'),
    'body', coalesce(new.content, 'You have a new notification'),
    'data', jsonb_build_object(
      'type', new.type,
      'notification_id', new.id,
      'related_id', new.related_id
    )
  );

  select net.http_post(
    url := fn_endpoint,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_role_key,
      'Content-Type', 'application/json'
    ),
    body := payload
  ) into request_id;

  raise log 'send_push_for_notification: HTTP request queued with ID % for user %', 
    request_id, new.user_id;

  return new;
exception
  when others then
    raise warning 'send_push_for_notification error: %', SQLERRM;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_notification_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."barter_offers" to "anon";

grant insert on table "public"."barter_offers" to "anon";

grant references on table "public"."barter_offers" to "anon";

grant select on table "public"."barter_offers" to "anon";

grant trigger on table "public"."barter_offers" to "anon";

grant truncate on table "public"."barter_offers" to "anon";

grant update on table "public"."barter_offers" to "anon";

grant delete on table "public"."barter_offers" to "authenticated";

grant insert on table "public"."barter_offers" to "authenticated";

grant references on table "public"."barter_offers" to "authenticated";

grant select on table "public"."barter_offers" to "authenticated";

grant trigger on table "public"."barter_offers" to "authenticated";

grant truncate on table "public"."barter_offers" to "authenticated";

grant update on table "public"."barter_offers" to "authenticated";

grant delete on table "public"."barter_offers" to "service_role";

grant insert on table "public"."barter_offers" to "service_role";

grant references on table "public"."barter_offers" to "service_role";

grant select on table "public"."barter_offers" to "service_role";

grant trigger on table "public"."barter_offers" to "service_role";

grant truncate on table "public"."barter_offers" to "service_role";

grant update on table "public"."barter_offers" to "service_role";

grant delete on table "public"."counter_offers" to "anon";

grant insert on table "public"."counter_offers" to "anon";

grant references on table "public"."counter_offers" to "anon";

grant select on table "public"."counter_offers" to "anon";

grant trigger on table "public"."counter_offers" to "anon";

grant truncate on table "public"."counter_offers" to "anon";

grant update on table "public"."counter_offers" to "anon";

grant delete on table "public"."counter_offers" to "authenticated";

grant insert on table "public"."counter_offers" to "authenticated";

grant references on table "public"."counter_offers" to "authenticated";

grant select on table "public"."counter_offers" to "authenticated";

grant trigger on table "public"."counter_offers" to "authenticated";

grant truncate on table "public"."counter_offers" to "authenticated";

grant update on table "public"."counter_offers" to "authenticated";

grant delete on table "public"."counter_offers" to "service_role";

grant insert on table "public"."counter_offers" to "service_role";

grant references on table "public"."counter_offers" to "service_role";

grant select on table "public"."counter_offers" to "service_role";

grant trigger on table "public"."counter_offers" to "service_role";

grant truncate on table "public"."counter_offers" to "service_role";

grant update on table "public"."counter_offers" to "service_role";

grant delete on table "public"."message_files" to "anon";

grant insert on table "public"."message_files" to "anon";

grant references on table "public"."message_files" to "anon";

grant select on table "public"."message_files" to "anon";

grant trigger on table "public"."message_files" to "anon";

grant truncate on table "public"."message_files" to "anon";

grant update on table "public"."message_files" to "anon";

grant delete on table "public"."message_files" to "authenticated";

grant insert on table "public"."message_files" to "authenticated";

grant references on table "public"."message_files" to "authenticated";

grant select on table "public"."message_files" to "authenticated";

grant trigger on table "public"."message_files" to "authenticated";

grant truncate on table "public"."message_files" to "authenticated";

grant update on table "public"."message_files" to "authenticated";

grant delete on table "public"."message_files" to "service_role";

grant insert on table "public"."message_files" to "service_role";

grant references on table "public"."message_files" to "service_role";

grant select on table "public"."message_files" to "service_role";

grant trigger on table "public"."message_files" to "service_role";

grant truncate on table "public"."message_files" to "service_role";

grant update on table "public"."message_files" to "service_role";

grant delete on table "public"."message_reactions" to "anon";

grant insert on table "public"."message_reactions" to "anon";

grant references on table "public"."message_reactions" to "anon";

grant select on table "public"."message_reactions" to "anon";

grant trigger on table "public"."message_reactions" to "anon";

grant truncate on table "public"."message_reactions" to "anon";

grant update on table "public"."message_reactions" to "anon";

grant delete on table "public"."message_reactions" to "authenticated";

grant insert on table "public"."message_reactions" to "authenticated";

grant references on table "public"."message_reactions" to "authenticated";

grant select on table "public"."message_reactions" to "authenticated";

grant trigger on table "public"."message_reactions" to "authenticated";

grant truncate on table "public"."message_reactions" to "authenticated";

grant update on table "public"."message_reactions" to "authenticated";

grant delete on table "public"."message_reactions" to "service_role";

grant insert on table "public"."message_reactions" to "service_role";

grant references on table "public"."message_reactions" to "service_role";

grant select on table "public"."message_reactions" to "service_role";

grant trigger on table "public"."message_reactions" to "service_role";

grant truncate on table "public"."message_reactions" to "service_role";

grant update on table "public"."message_reactions" to "service_role";

grant delete on table "public"."message_threads" to "anon";

grant insert on table "public"."message_threads" to "anon";

grant references on table "public"."message_threads" to "anon";

grant select on table "public"."message_threads" to "anon";

grant trigger on table "public"."message_threads" to "anon";

grant truncate on table "public"."message_threads" to "anon";

grant update on table "public"."message_threads" to "anon";

grant delete on table "public"."message_threads" to "authenticated";

grant insert on table "public"."message_threads" to "authenticated";

grant references on table "public"."message_threads" to "authenticated";

grant select on table "public"."message_threads" to "authenticated";

grant trigger on table "public"."message_threads" to "authenticated";

grant truncate on table "public"."message_threads" to "authenticated";

grant update on table "public"."message_threads" to "authenticated";

grant delete on table "public"."message_threads" to "service_role";

grant insert on table "public"."message_threads" to "service_role";

grant references on table "public"."message_threads" to "service_role";

grant select on table "public"."message_threads" to "service_role";

grant trigger on table "public"."message_threads" to "service_role";

grant truncate on table "public"."message_threads" to "service_role";

grant update on table "public"."message_threads" to "service_role";

grant delete on table "public"."offer_expirations" to "anon";

grant insert on table "public"."offer_expirations" to "anon";

grant references on table "public"."offer_expirations" to "anon";

grant select on table "public"."offer_expirations" to "anon";

grant trigger on table "public"."offer_expirations" to "anon";

grant truncate on table "public"."offer_expirations" to "anon";

grant update on table "public"."offer_expirations" to "anon";

grant delete on table "public"."offer_expirations" to "authenticated";

grant insert on table "public"."offer_expirations" to "authenticated";

grant references on table "public"."offer_expirations" to "authenticated";

grant select on table "public"."offer_expirations" to "authenticated";

grant trigger on table "public"."offer_expirations" to "authenticated";

grant truncate on table "public"."offer_expirations" to "authenticated";

grant update on table "public"."offer_expirations" to "authenticated";

grant delete on table "public"."offer_expirations" to "service_role";

grant insert on table "public"."offer_expirations" to "service_role";

grant references on table "public"."offer_expirations" to "service_role";

grant select on table "public"."offer_expirations" to "service_role";

grant trigger on table "public"."offer_expirations" to "service_role";

grant truncate on table "public"."offer_expirations" to "service_role";

grant update on table "public"."offer_expirations" to "service_role";

grant delete on table "public"."offer_templates" to "anon";

grant insert on table "public"."offer_templates" to "anon";

grant references on table "public"."offer_templates" to "anon";

grant select on table "public"."offer_templates" to "anon";

grant trigger on table "public"."offer_templates" to "anon";

grant truncate on table "public"."offer_templates" to "anon";

grant update on table "public"."offer_templates" to "anon";

grant delete on table "public"."offer_templates" to "authenticated";

grant insert on table "public"."offer_templates" to "authenticated";

grant references on table "public"."offer_templates" to "authenticated";

grant select on table "public"."offer_templates" to "authenticated";

grant trigger on table "public"."offer_templates" to "authenticated";

grant truncate on table "public"."offer_templates" to "authenticated";

grant update on table "public"."offer_templates" to "authenticated";

grant delete on table "public"."offer_templates" to "service_role";

grant insert on table "public"."offer_templates" to "service_role";

grant references on table "public"."offer_templates" to "service_role";

grant select on table "public"."offer_templates" to "service_role";

grant trigger on table "public"."offer_templates" to "service_role";

grant truncate on table "public"."offer_templates" to "service_role";

grant update on table "public"."offer_templates" to "service_role";

grant delete on table "public"."push_settings" to "anon";

grant insert on table "public"."push_settings" to "anon";

grant references on table "public"."push_settings" to "anon";

grant select on table "public"."push_settings" to "anon";

grant trigger on table "public"."push_settings" to "anon";

grant truncate on table "public"."push_settings" to "anon";

grant update on table "public"."push_settings" to "anon";

grant delete on table "public"."push_settings" to "authenticated";

grant insert on table "public"."push_settings" to "authenticated";

grant references on table "public"."push_settings" to "authenticated";

grant select on table "public"."push_settings" to "authenticated";

grant trigger on table "public"."push_settings" to "authenticated";

grant truncate on table "public"."push_settings" to "authenticated";

grant update on table "public"."push_settings" to "authenticated";

grant delete on table "public"."push_settings" to "service_role";

grant insert on table "public"."push_settings" to "service_role";

grant references on table "public"."push_settings" to "service_role";

grant select on table "public"."push_settings" to "service_role";

grant trigger on table "public"."push_settings" to "service_role";

grant truncate on table "public"."push_settings" to "service_role";

grant update on table "public"."push_settings" to "service_role";

grant delete on table "public"."thread_members" to "anon";

grant insert on table "public"."thread_members" to "anon";

grant references on table "public"."thread_members" to "anon";

grant select on table "public"."thread_members" to "anon";

grant trigger on table "public"."thread_members" to "anon";

grant truncate on table "public"."thread_members" to "anon";

grant update on table "public"."thread_members" to "anon";

grant delete on table "public"."thread_members" to "authenticated";

grant insert on table "public"."thread_members" to "authenticated";

grant references on table "public"."thread_members" to "authenticated";

grant select on table "public"."thread_members" to "authenticated";

grant trigger on table "public"."thread_members" to "authenticated";

grant truncate on table "public"."thread_members" to "authenticated";

grant update on table "public"."thread_members" to "authenticated";

grant delete on table "public"."thread_members" to "service_role";

grant insert on table "public"."thread_members" to "service_role";

grant references on table "public"."thread_members" to "service_role";

grant select on table "public"."thread_members" to "service_role";

grant trigger on table "public"."thread_members" to "service_role";

grant truncate on table "public"."thread_members" to "service_role";

grant update on table "public"."thread_members" to "service_role";

grant delete on table "public"."user_history" to "anon";

grant insert on table "public"."user_history" to "anon";

grant references on table "public"."user_history" to "anon";

grant select on table "public"."user_history" to "anon";

grant trigger on table "public"."user_history" to "anon";

grant truncate on table "public"."user_history" to "anon";

grant update on table "public"."user_history" to "anon";

grant delete on table "public"."user_history" to "authenticated";

grant insert on table "public"."user_history" to "authenticated";

grant references on table "public"."user_history" to "authenticated";

grant select on table "public"."user_history" to "authenticated";

grant trigger on table "public"."user_history" to "authenticated";

grant truncate on table "public"."user_history" to "authenticated";

grant update on table "public"."user_history" to "authenticated";

grant delete on table "public"."user_history" to "service_role";

grant insert on table "public"."user_history" to "service_role";

grant references on table "public"."user_history" to "service_role";

grant select on table "public"."user_history" to "service_role";

grant trigger on table "public"."user_history" to "service_role";

grant truncate on table "public"."user_history" to "service_role";

grant update on table "public"."user_history" to "service_role";


  create policy "deny_all_clients"
  on "public"."account_deletion_audit"
  as permissive
  for all
  to public
using (false);



  create policy "Users can create offers"
  on "public"."barter_offers"
  as permissive
  for insert
  to authenticated
with check ((sender_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update their offers"
  on "public"."barter_offers"
  as permissive
  for update
  to authenticated
using ((sender_id = ( SELECT auth.uid() AS uid)))
with check ((sender_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their offers"
  on "public"."barter_offers"
  as permissive
  for select
  to authenticated
using (((sender_id = ( SELECT auth.uid() AS uid)) OR (receiver_id = ( SELECT auth.uid() AS uid))));



  create policy "Users can create counter offers"
  on "public"."counter_offers"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = counter_offers.counter_offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can update counter offers they created"
  on "public"."counter_offers"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = counter_offers.counter_offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = counter_offers.counter_offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can view counter offers they're involved in"
  on "public"."counter_offers"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE (((barter_offers.id = counter_offers.original_offer_id) OR (barter_offers.id = counter_offers.counter_offer_id)) AND ((barter_offers.sender_id = ( SELECT auth.uid() AS uid)) OR (barter_offers.receiver_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users can add files to their messages"
  on "public"."message_files"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.messages
  WHERE ((messages.id = message_files.message_id) AND (messages.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can delete files from their messages"
  on "public"."message_files"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.messages
  WHERE ((messages.id = message_files.message_id) AND (messages.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can view files in their messages"
  on "public"."message_files"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.messages
  WHERE ((messages.id = message_files.message_id) AND ((messages.sender_id = ( SELECT auth.uid() AS uid)) OR (messages.receiver_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users can add reactions to messages they can see"
  on "public"."message_reactions"
  as permissive
  for insert
  to authenticated
with check (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.messages
  WHERE ((messages.id = message_reactions.message_id) AND ((messages.sender_id = ( SELECT auth.uid() AS uid)) OR (messages.receiver_id = ( SELECT auth.uid() AS uid))))))));



  create policy "Users can remove their own reactions"
  on "public"."message_reactions"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view reactions on their messages"
  on "public"."message_reactions"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.messages
  WHERE ((messages.id = message_reactions.message_id) AND ((messages.sender_id = ( SELECT auth.uid() AS uid)) OR (messages.receiver_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users can create threads in their conversations"
  on "public"."message_threads"
  as permissive
  for insert
  to authenticated
with check (((( SELECT auth.uid() AS uid) = created_by) AND ((item_id IS NULL) OR (public.get_item_owner(item_id) = ( SELECT auth.uid() AS uid)) OR public.is_thread_member(( SELECT auth.uid() AS uid), id))));



  create policy "Users can delete threads they created"
  on "public"."message_threads"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = created_by));



  create policy "Users can update threads they created"
  on "public"."message_threads"
  as permissive
  for update
  to authenticated
using ((auth.uid() = created_by))
with check ((auth.uid() = created_by));



  create policy "Users can view threads in their conversations"
  on "public"."message_threads"
  as permissive
  for select
  to authenticated
using ((((public.get_item_owner(item_id) IS NOT NULL) AND (public.get_item_owner(item_id) = ( SELECT auth.uid() AS uid))) OR public.is_thread_member(( SELECT auth.uid() AS uid), id) OR (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE ((m.thread_id = message_threads.id) AND ((m.sender_id = ( SELECT auth.uid() AS uid)) OR (m.receiver_id = ( SELECT auth.uid() AS uid))))))));



  create policy "insert message threads"
  on "public"."message_threads"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = created_by) AND ((item_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.items i
  WHERE (i.id = message_threads.item_id))))));



  create policy "message_threads_insert_allowed"
  on "public"."message_threads"
  as permissive
  for insert
  to authenticated
with check (((item_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.items i
  WHERE ((i.id = message_threads.item_id) AND (i.user_id = ( SELECT auth.uid() AS uid))))) OR public.is_thread_member(( SELECT auth.uid() AS uid), id)));



  create policy "Users can update read status of received messages"
  on "public"."messages"
  as permissive
  for update
  to authenticated
using ((receiver_id = ( SELECT auth.uid() AS uid)))
with check ((receiver_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can create expirations for their offers"
  on "public"."offer_expirations"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = offer_expirations.offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can update expirations for their offers"
  on "public"."offer_expirations"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = offer_expirations.offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))))
with check ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = offer_expirations.offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can view expirations for their offers"
  on "public"."offer_expirations"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.barter_offers
  WHERE ((barter_offers.id = offer_expirations.offer_id) AND (barter_offers.sender_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users can create their own templates"
  on "public"."offer_templates"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can delete their own templates"
  on "public"."offer_templates"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update their own templates"
  on "public"."offer_templates"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their own templates"
  on "public"."offer_templates"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Service role can read push settings"
  on "public"."push_settings"
  as permissive
  for select
  to service_role
using (true);



  create policy "Users can create message reports"
  on "public"."reported_messages"
  as permissive
  for insert
  to authenticated
with check ((reporter_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their message reports"
  on "public"."reported_messages"
  as permissive
  for select
  to authenticated
using ((reporter_id = ( SELECT auth.uid() AS uid)));



  create policy "Moderators can view reports"
  on "public"."reports"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.moderation_actions
  WHERE (moderation_actions.moderator_id = ( SELECT auth.uid() AS uid))
 LIMIT 1)));



  create policy "thread_members_select_member_only"
  on "public"."thread_members"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_thread_member(( SELECT auth.uid() AS uid), thread_id)));



  create policy "System can insert history records"
  on "public"."user_history"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Users can view their own history"
  on "public"."user_history"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can create blocks"
  on "public"."blocked_users"
  as permissive
  for insert
  to authenticated
with check ((blocker_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can remove blocks"
  on "public"."blocked_users"
  as permissive
  for delete
  to authenticated
using ((blocker_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their blocks"
  on "public"."blocked_users"
  as permissive
  for select
  to authenticated
using ((blocker_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can create dismissals"
  on "public"."changelog_dismissals"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their own dismissals"
  on "public"."changelog_dismissals"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Moderators can view all filter logs"
  on "public"."content_filter_logs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.moderation_actions
  WHERE (moderation_actions.moderator_id = ( SELECT auth.uid() AS uid))
 LIMIT 1)));



  create policy "Users can view their own filter logs"
  on "public"."content_filter_logs"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can delete their own pending requests"
  on "public"."friend_requests"
  as permissive
  for delete
  to authenticated
using ((sender_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can send friend requests"
  on "public"."friend_requests"
  as permissive
  for insert
  to authenticated
with check ((sender_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update received requests"
  on "public"."friend_requests"
  as permissive
  for update
  to authenticated
using ((receiver_id = ( SELECT auth.uid() AS uid)))
with check ((receiver_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their own friend requests"
  on "public"."friend_requests"
  as permissive
  for select
  to authenticated
using (((sender_id = ( SELECT auth.uid() AS uid)) OR (receiver_id = ( SELECT auth.uid() AS uid))));



  create policy "Users can delete their friendships"
  on "public"."friendships"
  as permissive
  for delete
  to authenticated
using (((user1_id = ( SELECT auth.uid() AS uid)) OR (user2_id = ( SELECT auth.uid() AS uid))));



  create policy "Users can view their friendships"
  on "public"."friendships"
  as permissive
  for select
  to authenticated
using (((user1_id = ( SELECT auth.uid() AS uid)) OR (user2_id = ( SELECT auth.uid() AS uid))));



  create policy "Users can create items"
  on "public"."items"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can delete own items"
  on "public"."items"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update own items"
  on "public"."items"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can send messages"
  on "public"."messages"
  as permissive
  for insert
  to authenticated
with check ((sender_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their messages"
  on "public"."messages"
  as permissive
  for select
  to authenticated
using (((sender_id = ( SELECT auth.uid() AS uid)) OR (receiver_id = ( SELECT auth.uid() AS uid))));



  create policy "Moderators can view all moderation actions"
  on "public"."moderation_actions"
  as permissive
  for select
  to authenticated
using ((moderator_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can delete their own notification settings"
  on "public"."notification_settings"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can insert their own notification settings"
  on "public"."notification_settings"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update their own notification settings"
  on "public"."notification_settings"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their own notification settings"
  on "public"."notification_settings"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Moderators can update reports"
  on "public"."reports"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.moderation_actions
  WHERE (moderation_actions.moderator_id = ( SELECT auth.uid() AS uid))
 LIMIT 1)))
with check ((EXISTS ( SELECT 1
   FROM public.moderation_actions
  WHERE (moderation_actions.moderator_id = ( SELECT auth.uid() AS uid))
 LIMIT 1)));



  create policy "Reporters can view their reports"
  on "public"."reports"
  as permissive
  for select
  to authenticated
using ((reporter_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can create reports"
  on "public"."reports"
  as permissive
  for insert
  to authenticated
with check ((reporter_id = ( SELECT auth.uid() AS uid)));



  create policy "Users insert their policy acceptance"
  on "public"."user_policy_acceptances"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users select own policy acceptance"
  on "public"."user_policy_acceptances"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update own profile"
  on "public"."users"
  as permissive
  for update
  to authenticated
using ((id = ( SELECT auth.uid() AS uid)))
with check ((id = ( SELECT auth.uid() AS uid)));



  create policy "Users can add watched items"
  on "public"."watched_items"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can remove watched items"
  on "public"."watched_items"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view their watched items"
  on "public"."watched_items"
  as permissive
  for select
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));


CREATE TRIGGER track_item_creation_trigger AFTER INSERT ON public.items FOR EACH ROW EXECUTE FUNCTION public.track_item_creation();

CREATE TRIGGER track_item_deletion_trigger BEFORE DELETE ON public.items FOR EACH ROW EXECUTE FUNCTION public.track_item_deletion();

CREATE TRIGGER track_item_update_trigger AFTER UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.track_item_update();

CREATE TRIGGER set_message_thread_created_by_trg BEFORE INSERT ON public.message_threads FOR EACH ROW EXECUTE FUNCTION public.set_message_thread_created_by();

CREATE TRIGGER forward_messages_to_realtime_trigger AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.forward_messages_to_realtime();

CREATE TRIGGER messages_broadcast_trigger AFTER INSERT OR DELETE OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_broadcast_trigger();

CREATE TRIGGER trigger_update_message_read_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_message_read_at();

CREATE TRIGGER trigger_update_thread_updated_at AFTER INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_thread_updated_at();

CREATE TRIGGER trigger_update_template_updated_at BEFORE UPDATE ON public.offer_templates FOR EACH ROW EXECUTE FUNCTION public.update_template_updated_at();


  create policy "thread_members_can_read_realtime_messages"
  on "realtime"."messages"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.thread_members tm
  WHERE (((tm.thread_id)::text = split_part(messages.topic, ':'::text, 2)) AND (tm.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "thread_members_can_write_realtime_messages"
  on "realtime"."messages"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.thread_members tm
  WHERE (((tm.thread_id)::text = split_part(messages.topic, ':'::text, 2)) AND (tm.user_id = ( SELECT auth.uid() AS uid))))));


CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_09 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_10 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_11 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_12 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_13 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_14 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();

CREATE TRIGGER messages_set_default_topic_tr BEFORE INSERT OR UPDATE ON realtime.messages_2026_01_15 FOR EACH ROW EXECUTE FUNCTION realtime.set_default_topic_if_null();


  create policy "Anyone can view images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'item-images'::text));



  create policy "Authenticated users can upload images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'item-images'::text));



  create policy "Give users authenticated access to folder 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1oj01fe_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Give users authenticated access to folder 1oj01fe_2"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = 'private'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Users can delete own images"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = owner));



  create policy "Users can update own images"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((auth.uid() = owner));



  create policy "Users can upload message images"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'message-images'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Users can view message images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'message-images'::text));



