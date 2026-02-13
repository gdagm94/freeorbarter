-- ============================================================================
-- Migration: Fix search_path on all 15 flagged functions
-- Date: 2026-02-13
-- Purpose: Resolve Supabase Lint 0011 (function_search_path_mutable)
--          by pinning search_path to empty string on all affected functions.
--          This prevents search-path hijacking attacks, especially important
--          for SECURITY DEFINER functions that run with elevated privileges.
-- ============================================================================

-- 1. create_welcome_notification() — SECURITY DEFINER trigger
ALTER FUNCTION public.create_welcome_notification()
  SET search_path TO '';

-- 2. create_notification_on_friend_request() — SECURITY DEFINER trigger
ALTER FUNCTION public.create_notification_on_friend_request()
  SET search_path TO '';

-- 3. create_notification_on_friend_request_accepted() — SECURITY DEFINER trigger
ALTER FUNCTION public.create_notification_on_friend_request_accepted()
  SET search_path TO '';

-- 4. create_notification_on_direct_message() — SECURITY DEFINER trigger
ALTER FUNCTION public.create_notification_on_direct_message()
  SET search_path TO '';

-- 5. send_push_for_notification() — SECURITY DEFINER trigger
ALTER FUNCTION public.send_push_for_notification()
  SET search_path TO '';

-- 6. handle_new_user() — SECURITY DEFINER trigger
ALTER FUNCTION public.handle_new_user()
  SET search_path TO '';

-- 7. handle_user_update() — SECURITY DEFINER trigger
ALTER FUNCTION public.handle_user_update()
  SET search_path TO '';

-- 8. get_item_owner(uuid) — SECURITY DEFINER function
ALTER FUNCTION public.get_item_owner(uuid)
  SET search_path TO '';

-- 9. get_or_create_thread(uuid[], uuid, text) — SECURITY DEFINER function
ALTER FUNCTION public.get_or_create_thread(uuid[], uuid, text)
  SET search_path TO '';

-- 10. add_thread_member(uuid, uuid, text) — SECURITY DEFINER function
ALTER FUNCTION public.add_thread_member(uuid, uuid, text)
  SET search_path TO '';

-- 11. remove_thread_member(uuid, uuid) — SECURITY DEFINER function
ALTER FUNCTION public.remove_thread_member(uuid, uuid)
  SET search_path TO '';

-- 12. is_thread_member(uuid, uuid) — function
ALTER FUNCTION public.is_thread_member(uuid, uuid)
  SET search_path TO '';

-- 13. get_thread_members(uuid) — function
ALTER FUNCTION public.get_thread_members(uuid)
  SET search_path TO '';

-- 14. set_message_thread_created_by() — trigger
ALTER FUNCTION public.set_message_thread_created_by()
  SET search_path TO '';

-- 15. messages_broadcast_trigger() — trigger
ALTER FUNCTION public.messages_broadcast_trigger()
  SET search_path TO '';
