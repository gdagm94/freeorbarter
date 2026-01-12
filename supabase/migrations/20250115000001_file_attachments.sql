/*
  # File Attachments Support

  Note: guarded so it only runs after messages table exists.
*/

DO $$
BEGIN
  IF to_regclass('public.messages') IS NULL THEN
    RAISE NOTICE 'messages table not found; skipping 20250115000001_file_attachments.sql';
    RETURN;
  END IF;

  -- Add file_url column to messages table for backward compatibility
  EXECUTE 'ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url text';

  -- Create message_files table
  EXECUTE $ddl$
    CREATE TABLE IF NOT EXISTS public.message_files (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
      file_url text NOT NULL,
      file_name text NOT NULL,
      file_type text NOT NULL,
      file_size bigint,
      created_at timestamptz DEFAULT now()
    )
  $ddl$;

  -- Enable RLS
  EXECUTE 'ALTER TABLE public.message_files ENABLE ROW LEVEL SECURITY';

  -- Create indexes for better performance
  EXECUTE 'CREATE INDEX IF NOT EXISTS message_files_message_id_idx ON public.message_files(message_id)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS message_files_file_type_idx ON public.message_files(file_type)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS messages_file_url_idx ON public.messages(file_url)';

  -- Create policies for message_files
  EXECUTE $pol$
    CREATE POLICY "Users can view files in their messages"
      ON public.message_files FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.messages 
          WHERE messages.id = message_files.message_id 
          AND (messages.sender_id = auth.uid() OR messages.receiver_id = auth.uid())
        )
      )
  $pol$;

  EXECUTE $pol$
    CREATE POLICY "Users can add files to their messages"
      ON public.message_files FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.messages 
          WHERE messages.id = message_files.message_id 
          AND messages.sender_id = auth.uid()
        )
      )
  $pol$;

  EXECUTE $pol$
    CREATE POLICY "Users can delete files from their messages"
      ON public.message_files FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.messages 
          WHERE messages.id = message_files.message_id 
          AND messages.sender_id = auth.uid()
        )
      )
  $pol$;
END;
$$;

-- Create storage bucket for message files (safe to run outside messages guard)
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-files', 'message-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for message files
CREATE POLICY "Users can upload files to message-files bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'message-files');

CREATE POLICY "Users can view files in message-files bucket"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'message-files');

CREATE POLICY "Users can delete their own files from message-files bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'message-files' AND auth.uid()::text = (storage.foldername(name))[1]);
