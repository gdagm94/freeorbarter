/*
  # Add system_alerts to notification_type enum

  1. Changes
    - Add 'system_alerts' as a valid value to the notification_type enum
    - This allows the application to create notifications of type 'system_alerts'

  2. Security
    - No changes to RLS policies needed as this only extends the enum values
*/

-- Add 'system_alerts' to the notification_type enum
ALTER TYPE notification_type ADD VALUE 'system_alerts';