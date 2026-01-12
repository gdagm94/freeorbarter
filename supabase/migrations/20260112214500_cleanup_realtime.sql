-- Drop invalid realtime triggers safely
DO $$ 
BEGIN 
  -- realtime.messages
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages;
  END IF;

  -- realtime.messages_2026_01_09
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_09') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_09;
  END IF;

  -- realtime.messages_2026_01_10
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_10') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_10;
  END IF;

  -- realtime.messages_2026_01_11
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_11') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_11;
  END IF;

  -- realtime.messages_2026_01_12
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_12') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_12;
  END IF;

  -- realtime.messages_2026_01_13
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_13') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_13;
  END IF;

  -- realtime.messages_2026_01_14
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_14') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_14;
  END IF;

  -- realtime.messages_2026_01_15
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages_2026_01_15') THEN
    DROP TRIGGER IF EXISTS messages_set_default_topic_tr ON realtime.messages_2026_01_15;
  END IF;

END $$;
