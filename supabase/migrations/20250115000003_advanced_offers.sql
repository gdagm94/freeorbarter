/*
  # Advanced Offer Management System

  1. New Tables
    - offer_templates
      - id (uuid, primary key)
      - user_id (uuid, foreign key)
      - title (text, template name)
      - content (text, template content)
      - created_at (timestamp)
      - updated_at (timestamp)

    - offer_expirations
      - id (uuid, primary key)
      - offer_id (uuid, foreign key to barter_offers)
      - expires_at (timestamp)
      - is_active (boolean, default true)
      - created_at (timestamp)

    - counter_offers
      - id (uuid, primary key)
      - original_offer_id (uuid, foreign key to barter_offers)
      - counter_offer_id (uuid, foreign key to barter_offers)
      - message (text, optional message with counter offer)
      - status (enum: pending, accepted, declined, expired)
      - created_at (timestamp)
      - updated_at (timestamp)

  2. Changes
    - Add expiration_date column to barter_offers table
    - Add template_id column to barter_offers table
    - Add parent_offer_id column to barter_offers table for counter offers
    - Add indexes for efficient querying
    - Add RLS policies for new tables

  3. Security
    - Enable RLS on all new tables
    - Add policies for users to manage their own offers and templates
*/

-- Add new columns to barter_offers table
ALTER TABLE barter_offers ADD COLUMN IF NOT EXISTS expiration_date timestamptz;
ALTER TABLE barter_offers ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE barter_offers ADD COLUMN IF NOT EXISTS parent_offer_id uuid REFERENCES barter_offers(id) ON DELETE CASCADE;

-- Create offer_templates table
CREATE TABLE IF NOT EXISTS offer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer_expirations table
CREATE TABLE IF NOT EXISTS offer_expirations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES barter_offers(id) ON DELETE CASCADE NOT NULL,
  expires_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create counter_offers table
CREATE TABLE IF NOT EXISTS counter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_offer_id uuid REFERENCES barter_offers(id) ON DELETE CASCADE NOT NULL,
  counter_offer_id uuid REFERENCES barter_offers(id) ON DELETE CASCADE NOT NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_expirations ENABLE ROW LEVEL SECURITY;
ALTER TABLE counter_offers ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS offer_templates_user_id_idx ON offer_templates(user_id);
CREATE INDEX IF NOT EXISTS offer_expirations_offer_id_idx ON offer_expirations(offer_id);
CREATE INDEX IF NOT EXISTS offer_expirations_expires_at_idx ON offer_expirations(expires_at);
CREATE INDEX IF NOT EXISTS counter_offers_original_offer_id_idx ON counter_offers(original_offer_id);
CREATE INDEX IF NOT EXISTS counter_offers_counter_offer_id_idx ON counter_offers(counter_offer_id);
CREATE INDEX IF NOT EXISTS counter_offers_status_idx ON counter_offers(status);
CREATE INDEX IF NOT EXISTS barter_offers_expiration_date_idx ON barter_offers(expiration_date);
CREATE INDEX IF NOT EXISTS barter_offers_template_id_idx ON barter_offers(template_id);
CREATE INDEX IF NOT EXISTS barter_offers_parent_offer_id_idx ON barter_offers(parent_offer_id);

-- Create policies for offer_templates
CREATE POLICY "Users can view their own templates"
  ON offer_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own templates"
  ON offer_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON offer_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON offer_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for offer_expirations
CREATE POLICY "Users can view expirations for their offers"
  ON offer_expirations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = offer_expirations.offer_id 
      AND (barter_offers.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM items 
             WHERE items.id = barter_offers.requested_item_id 
             AND items.user_id = auth.uid()
           ))
    )
  );

CREATE POLICY "Users can create expirations for their offers"
  ON offer_expirations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = offer_expirations.offer_id 
      AND barter_offers.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can update expirations for their offers"
  ON offer_expirations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = offer_expirations.offer_id 
      AND barter_offers.sender_id = auth.uid()
    )
  );

-- Create policies for counter_offers
CREATE POLICY "Users can view counter offers they're involved in"
  ON counter_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = counter_offers.original_offer_id 
      AND (barter_offers.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM items 
             WHERE items.id = barter_offers.requested_item_id 
             AND items.user_id = auth.uid()
           ))
    ) OR
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = counter_offers.counter_offer_id 
      AND (barter_offers.sender_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM items 
             WHERE items.id = barter_offers.requested_item_id 
             AND items.user_id = auth.uid()
           ))
    )
  );

CREATE POLICY "Users can create counter offers"
  ON counter_offers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = counter_offers.counter_offer_id 
      AND barter_offers.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can update counter offers they created"
  ON counter_offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM barter_offers 
      WHERE barter_offers.id = counter_offers.counter_offer_id 
      AND barter_offers.sender_id = auth.uid()
    )
  );

-- Create function to automatically expire offers
CREATE OR REPLACE FUNCTION expire_offers()
RETURNS void AS $$
BEGIN
  -- Update expired offers
  UPDATE barter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND expiration_date IS NOT NULL 
  AND expiration_date < now();
  
  -- Update expired counter offers
  UPDATE counter_offers 
  SET status = 'expired'
  WHERE status = 'pending' 
  AND EXISTS (
    SELECT 1 FROM barter_offers 
    WHERE barter_offers.id = counter_offers.original_offer_id 
    AND barter_offers.status = 'expired'
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to update template updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update template timestamp
DROP TRIGGER IF EXISTS trigger_update_template_updated_at ON offer_templates;
CREATE TRIGGER trigger_update_template_updated_at
  BEFORE UPDATE ON offer_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_template_updated_at();
