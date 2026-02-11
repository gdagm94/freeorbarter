-- Add 'welcome' to the notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'welcome';

-- Create trigger function: insert welcome notification on new user creation
CREATE OR REPLACE FUNCTION public.create_welcome_notification()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, sender_id, type, content, related_id)
  VALUES (
    NEW.id,
    NULL,  -- system-generated, no sender
    'welcome',
    '👋 Welcome to FreeOrBarter! Complete your profile to start trading and sharing. Add a profile picture, set your location, and let the community know who you are.',
    NEW.id  -- related_id points to the user's own profile
  );
  RETURN NEW;
END;
$$;

-- Attach trigger to users table (fires only on INSERT, so existing users are unaffected)
CREATE TRIGGER on_user_created_welcome_notification
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_welcome_notification();
