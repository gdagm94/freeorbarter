/*
  # Account Deletion Helper

  1. Changes
    - Create `account_deletion_audit` table to log account removals for compliance
    - Add `delete_user_account_data` function to purge relational data prior to auth deletion
    - Function is defensive against missing tables and re-runnable without side effects

  2. Notes
    - The function relies on existing ON DELETE CASCADE constraints for core tables
    - Additional clean-up handles tables that may reference users without cascades
    - Metadata field can store structured context (reason, platform, etc.)
*/

CREATE TABLE IF NOT EXISTS account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_audit_user_id_key
  ON account_deletion_audit(user_id);

CREATE OR REPLACE FUNCTION delete_user_account_data(
  target_user_id uuid,
  target_email text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON TABLE account_deletion_audit IS
  'Stores a record for each user account deletion, including optional metadata for compliance.';

COMMENT ON FUNCTION delete_user_account_data(uuid, text, jsonb) IS
  'Purges relational data for the specified user and logs the deletion prior to removing the auth user.';

