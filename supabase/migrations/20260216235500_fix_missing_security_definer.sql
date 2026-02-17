-- ============================================================================
-- Migration: Add missing SECURITY DEFINER to notification trigger functions
-- Date: 2026-02-16
-- Purpose: Fix RLS violation when creating listings or adding to watchlists.
--          These functions were accidentally recreated without SECURITY DEFINER
--          in 20260113204500_fix_triggers_search_path.sql. The hardening
--          migration (20260213130000) then removed the permissive INSERT policy
--          on notifications, assuming all triggers bypass RLS — but these two
--          still ran as the invoking user, causing the RLS error.
-- ============================================================================

ALTER FUNCTION public.create_notification_on_new_listing_from_friend()
  SECURITY DEFINER;

ALTER FUNCTION public.create_notification_on_watchlist_add()
  SECURITY DEFINER;
