-- Add missing columns to messages table for voice message and file attachment support
ALTER TABLE "public"."messages"
  ADD COLUMN IF NOT EXISTS "file_name" TEXT,
  ADD COLUMN IF NOT EXISTS "file_type" TEXT,
  ADD COLUMN IF NOT EXISTS "voice_duration" REAL;
