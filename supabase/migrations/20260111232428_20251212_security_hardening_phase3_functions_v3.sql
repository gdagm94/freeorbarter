/*
  # Database Security and Performance Hardening - Phase 3: Function Search Path

  ## Summary
  Fixing function search path mutability for all public functions to prevent
  role-based SQL injection and improve security.
*/

ALTER FUNCTION update_notification_settings_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION handle_accepted_friend_request()
  SET search_path = pg_catalog;

ALTER FUNCTION update_message_read_at()
  SET search_path = pg_catalog;

ALTER FUNCTION update_blocked_keywords_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION create_notification_on_friend_request()
  SET search_path = pg_catalog;

ALTER FUNCTION create_notification_on_watchlist_add()
  SET search_path = pg_catalog;

ALTER FUNCTION create_notification_on_friend_request_accepted()
  SET search_path = pg_catalog;

ALTER FUNCTION create_notification_on_new_listing_from_friend()
  SET search_path = pg_catalog;

ALTER FUNCTION create_notification_on_direct_message()
  SET search_path = pg_catalog;

ALTER FUNCTION track_item_creation()
  SET search_path = pg_catalog;

ALTER FUNCTION track_item_update()
  SET search_path = pg_catalog;

ALTER FUNCTION track_item_deletion()
  SET search_path = pg_catalog;

ALTER FUNCTION ban_user(uuid, text)
  SET search_path = pg_catalog;

ALTER FUNCTION unban_user(uuid)
  SET search_path = pg_catalog;

ALTER FUNCTION reports_set_deadline()
  SET search_path = pg_catalog;

ALTER FUNCTION reports_set_first_response()
  SET search_path = pg_catalog;

ALTER FUNCTION update_thread_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION expire_offers()
  SET search_path = pg_catalog;

ALTER FUNCTION update_template_updated_at()
  SET search_path = pg_catalog;

ALTER FUNCTION handle_new_user()
  SET search_path = pg_catalog;

ALTER FUNCTION handle_message_status()
  SET search_path = pg_catalog;
