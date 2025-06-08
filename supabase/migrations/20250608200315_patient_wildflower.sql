/*
  # Fix database configuration parameters

  This migration sets the required configuration parameters that are used by database functions
  and triggers when processing friend requests and other operations.

  1. Configuration Parameters
    - Set `app.supabase_url` parameter for database functions
    - Set `app.supabase_anon_key` parameter for database functions

  These parameters are required by certain database functions that need to make HTTP requests
  or access Supabase configuration within the database context.
*/

-- Set the Supabase URL configuration parameter
ALTER DATABASE postgres SET "app.supabase_url" TO 'https://xvdltodlekapbklymsvz.supabase.co';

-- Set the Supabase anonymous key configuration parameter  
ALTER DATABASE postgres SET "app.supabase_anon_key" TO 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2ZGx0b2RsZWthcGJrbHltc3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkyOTM1NjgsImV4cCI6MjA1NDg2OTU2OH0.XBHXWOUx_B5SAFagTYDk-2F1M8THGagtNOaazqkQ95k';