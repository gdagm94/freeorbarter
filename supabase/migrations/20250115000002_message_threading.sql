/*
  # Message Threading System

  Note: guarded so it only runs after messages and items tables exist.
*/

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL OR to_regclass('public.items') IS NULL THEN
    RAISE NOTICE 'messages/items table not found; skipping 20250115000002_message_threading.sql';
    RETURN;
  END IF;

  -- Add thread_id column to messages table
  EXECUTE 'ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id uuid';

  -- Create message_threads table
  EXECUTE '
    CREATE TABLE IF NOT EXISTS public.message_threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      item_id uuid REFERENCES public.items(id) ON DELETE CASCADE,
      created_by uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      is_active boolean DEFAULT true
    )';

  -- Enable RLS
  EXECUTE 'ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY';

  -- Create indexes for better performance
  EXECUTE 'CREATE INDEX IF NOT EXISTS message_threads_item_id_idx ON public.message_threads(item_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS message_threads_created_by_idx ON public.message_threads(created_by)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS message_threads_is_active_idx ON public.message_threads(is_active)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON public.messages(thread_id)';

  -- Create policies for message_threads
  EXECUTE '
    CREATE POLICY "Users can view threads in their conversations"
      ON public.message_threads FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.items 
          WHERE items.id = message_threads.item_id 
          AND (items.user_id = auth.uid() OR 
               EXISTS (
                 SELECT 1 FROM public.messages 
                 WHERE messages.item_id = items.id 
                 AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
               ))
        ) OR
        EXISTS (
          SELECT 1 FROM public.messages 
          WHERE messages.thread_id = message_threads.id 
          AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can create threads in their conversations"
      ON public.message_threads FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = created_by AND
        (
          EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = message_threads.item_id 
            AND items.user_id = auth.uid()
          ) OR
          message_threads.item_id IS NULL
        )
      )';

  EXECUTE '
    CREATE POLICY "Users can update threads they created"
      ON public.message_threads FOR UPDATE
      TO authenticated
      USING (auth.uid() = created_by)
      WITH CHECK (auth.uid() = created_by)';

  EXECUTE '
    CREATE POLICY "Users can delete threads they created"
      ON public.message_threads FOR DELETE
      TO authenticated
      USING (auth.uid() = created_by)';

  -- Add foreign key constraint for thread_id in messages
  EXECUTE '
    ALTER TABLE public.messages 
    ADD CONSTRAINT fk_messages_thread_id 
    FOREIGN KEY (thread_id) REFERENCES public.message_threads(id) ON DELETE SET NULL';

  -- Create function to update thread updated_at timestamp
  EXECUTE
    'CREATE OR REPLACE FUNCTION public.update_thread_updated_at() RETURNS TRIGGER AS '
    || quote_literal(
      'BEGIN
         IF NEW.thread_id IS NOT NULL THEN
           UPDATE public.message_threads
           SET updated_at = now()
           WHERE id = NEW.thread_id;
         END IF;
         RETURN NEW;
       END;'
    )
    || ' LANGUAGE plpgsql;';

  -- Create trigger to automatically update thread timestamp
  EXECUTE 'DROP TRIGGER IF EXISTS trigger_update_thread_updated_at ON public.messages';
  EXECUTE 'CREATE TRIGGER trigger_update_thread_updated_at AFTER INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_thread_updated_at()';
END;
$$;
