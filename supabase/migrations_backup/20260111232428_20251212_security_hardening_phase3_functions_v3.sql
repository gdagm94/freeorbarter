/*
  # Function search_path hardening (guarded)
  Sets search_path=pg_catalog for known functions if they exist.
*/

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.update_notification_settings_updated_at()',
    'public.handle_accepted_friend_request()',
    'public.update_message_read_at()',
    'public.update_blocked_keywords_updated_at()',
    'public.create_notification_on_friend_request()',
    'public.create_notification_on_watchlist_add()',
    'public.create_notification_on_friend_request_accepted()',
    'public.create_notification_on_new_listing_from_friend()',
    'public.create_notification_on_direct_message()',
    'public.track_item_creation()',
    'public.track_item_update()',
    'public.track_item_deletion()',
    'public.ban_user(uuid, text)',
    'public.unban_user(uuid)',
    'public.reports_set_deadline()',
    'public.reports_set_first_response()',
    'public.update_thread_updated_at()',
    'public.expire_offers()',
    'public.update_template_updated_at()',
    'public.handle_new_user()',
    'public.handle_message_status()'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = fn
    ) THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog', fn);
    ELSE
      RAISE NOTICE 'Function % not found; skipping search_path update', fn;
    END IF;
  END LOOP;
END;
$$;
