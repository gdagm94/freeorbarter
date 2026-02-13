-- ============================================================================
-- Migration: Harden RLS policies on friendships, notifications, user_history
-- Date: 2026-02-13
-- Purpose: Resolve Supabase Lint 0024 (rls_policy_always_true)
--          Replace overly permissive WITH CHECK (true) INSERT policies.
-- ============================================================================

-- ============================================================================
-- 1. FRIENDSHIPS — Replace WITH CHECK (true) with proper validation
--    Client-side insert happens in acceptFriendRequest() — the inserting user
--    must be one of the two parties in the friendship.
--    The SECURITY DEFINER trigger (handle_accepted_friend_request) also
--    inserts but bypasses RLS, so this won't affect it.
-- ============================================================================

DROP POLICY IF EXISTS "System can insert friendships" ON public.friendships;

CREATE POLICY "Users can insert their own friendships"
  ON public.friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- ============================================================================
-- 2. NOTIFICATIONS — Drop the permissive policy entirely
--    All inserts come from SECURITY DEFINER trigger functions which bypass RLS:
--    - create_notification_on_friend_request()
--    - create_notification_on_friend_request_accepted()
--    - create_notification_on_direct_message()
--    - create_notification_on_new_listing_from_friend()
--    - create_notification_on_watchlist_add()
--    - create_welcome_notification()
--    No client-side code inserts into this table.
-- ============================================================================

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- ============================================================================
-- 3. USER_HISTORY — Drop the permissive policy entirely
--    All inserts come from SECURITY DEFINER trigger functions which bypass RLS:
--    - track_item_creation()
--    - track_item_deletion()
--    - track_item_update()
--    No client-side code inserts into this table.
-- ============================================================================

DROP POLICY IF EXISTS "System can insert history records" ON public.user_history;
