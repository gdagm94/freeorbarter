/*
  # User History Tracking

  Note: guarded to run only when required types/tables exist.
*/

-- Ensure enum exists
DO $$
BEGIN
  IF to_regtype('public.history_action_type') IS NULL THEN
    CREATE TYPE public.history_action_type AS ENUM ('created', 'updated', 'deleted');
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.items') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regtype('public.item_condition') IS NULL
     OR to_regtype('public.history_action_type') IS NULL THEN
    RAISE NOTICE 'items/users/types missing; skipping 20250115000004_user_history_tracking.sql';
    RETURN;
  END IF;

  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.user_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      action_type public.history_action_type NOT NULL,
      item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
      item_title text NOT NULL,
      item_description text,
      item_images text[],
      item_category text,
      item_condition public.item_condition,
      changes jsonb,
      created_at timestamptz DEFAULT now()
    )';

  EXECUTE 'ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY';

  EXECUTE '
    CREATE POLICY "Users can view their own history"
      ON public.user_history FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id)';

END;
$$;
