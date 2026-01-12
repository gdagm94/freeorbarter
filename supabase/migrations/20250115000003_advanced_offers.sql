/*
  # Advanced Offer Management System

  Note: guarded so it only runs after barter_offers exists.
*/

DO $$
BEGIN
  IF to_regclass('public.barter_offers') IS NULL THEN
    RAISE NOTICE 'barter_offers table not found; skipping 20250115000003_advanced_offers.sql';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.barter_offers ADD COLUMN IF NOT EXISTS expiration_date timestamptz';
  EXECUTE 'ALTER TABLE public.barter_offers ADD COLUMN IF NOT EXISTS template_id uuid';
  EXECUTE 'ALTER TABLE public.barter_offers ADD COLUMN IF NOT EXISTS parent_offer_id uuid REFERENCES public.barter_offers(id) ON DELETE CASCADE';

  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.offer_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
      title text NOT NULL,
      content text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )';

  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.offer_expirations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      offer_id uuid REFERENCES public.barter_offers(id) ON DELETE CASCADE NOT NULL,
      expires_at timestamptz NOT NULL,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    )';

  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.counter_offers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      original_offer_id uuid REFERENCES public.barter_offers(id) ON DELETE CASCADE NOT NULL,
      counter_offer_id uuid REFERENCES public.barter_offers(id) ON DELETE CASCADE NOT NULL,
      message text,
      status text DEFAULT ''pending'' CHECK (status IN (''pending'', ''accepted'', ''declined'', ''expired'')),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )';

  EXECUTE 'ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.offer_expirations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.counter_offers ENABLE ROW LEVEL SECURITY';

  EXECUTE 'CREATE INDEX IF NOT EXISTS offer_templates_user_id_idx ON public.offer_templates(user_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS offer_expirations_offer_id_idx ON public.offer_expirations(offer_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS offer_expirations_expires_at_idx ON public.offer_expirations(expires_at)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS counter_offers_original_offer_id_idx ON public.counter_offers(original_offer_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS counter_offers_counter_offer_id_idx ON public.counter_offers(counter_offer_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS counter_offers_status_idx ON public.counter_offers(status)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS barter_offers_expiration_date_idx ON public.barter_offers(expiration_date)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS barter_offers_template_id_idx ON public.barter_offers(template_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS barter_offers_parent_offer_id_idx ON public.barter_offers(parent_offer_id)';

  EXECUTE '
    CREATE POLICY "Users can view their own templates"
      ON public.offer_templates FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "Users can create their own templates"
      ON public.offer_templates FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "Users can update their own templates"
      ON public.offer_templates FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "Users can delete their own templates"
      ON public.offer_templates FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id)';

  EXECUTE '
    CREATE POLICY "Users can view expirations for their offers"
      ON public.offer_expirations FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = offer_expirations.offer_id 
          AND (barter_offers.sender_id = auth.uid() OR 
               EXISTS (
                 SELECT 1 FROM public.items 
                 WHERE items.id = barter_offers.requested_item_id 
                 AND items.user_id = auth.uid()
               ))
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can create expirations for their offers"
      ON public.offer_expirations FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = offer_expirations.offer_id 
          AND barter_offers.sender_id = auth.uid()
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can update expirations for their offers"
      ON public.offer_expirations FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = offer_expirations.offer_id 
          AND barter_offers.sender_id = auth.uid()
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can view counter offers they''re involved in"
      ON public.counter_offers FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = counter_offers.original_offer_id 
          AND (barter_offers.sender_id = auth.uid() OR 
               EXISTS (
                 SELECT 1 FROM public.items 
                 WHERE items.id = barter_offers.requested_item_id 
                 AND items.user_id = auth.uid()
               ))
        ) OR
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = counter_offers.counter_offer_id 
          AND (barter_offers.sender_id = auth.uid() OR 
               EXISTS (
                 SELECT 1 FROM public.items 
                 WHERE items.id = barter_offers.requested_item_id 
                 AND items.user_id = auth.uid()
               ))
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can create counter offers"
      ON public.counter_offers FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = counter_offers.counter_offer_id 
          AND barter_offers.sender_id = auth.uid()
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can update counter offers they created"
      ON public.counter_offers FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.barter_offers 
          WHERE barter_offers.id = counter_offers.counter_offer_id 
          AND barter_offers.sender_id = auth.uid()
        )
      )';
END;
$$;
