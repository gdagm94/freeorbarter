/*
  # Initial Schema for Barter Marketplace

  1. New Tables
    - users (extends auth.users)
      - id (uuid, primary key)
      - full_name (text)
      - avatar_url (text)
      - location (text)
      - created_at (timestamp)
    
    - items
      - id (uuid, primary key)
      - title (text)
      - description (text)
      - images (text array)
      - condition (enum)
      - category (text)
      - user_id (uuid, foreign key)
      - created_at (timestamp)
      - location (text)
      - status (enum)
    
    - messages
      - id (uuid, primary key)
      - sender_id (uuid, foreign key)
      - receiver_id (uuid, foreign key)
      - content (text)
      - created_at (timestamp)
      - item_id (uuid, foreign key)
      - offer_item_id (uuid, foreign key, nullable)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create custom types
CREATE TYPE item_condition AS ENUM ('new', 'like-new', 'good', 'fair', 'poor');
CREATE TYPE item_status AS ENUM ('available', 'pending', 'traded');

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  avatar_url text,
  location text,
  created_at timestamptz DEFAULT now()
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  images text[] NOT NULL,
  condition item_condition NOT NULL,
  category text NOT NULL,
  user_id uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  location text NOT NULL,
  status item_status DEFAULT 'available'
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES users(id) NOT NULL,
  receiver_id uuid REFERENCES users(id) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  item_id uuid REFERENCES items(id) NOT NULL,
  offer_item_id uuid REFERENCES items(id)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users policies
CREATE POLICY "Users can view all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Items policies
CREATE POLICY "Anyone can view available items"
  ON items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create items"
  ON items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- Create indexes
CREATE INDEX items_user_id_idx ON items(user_id);
CREATE INDEX items_category_idx ON items(category);
CREATE INDEX messages_sender_id_idx ON messages(sender_id);
CREATE INDEX messages_receiver_id_idx ON messages(receiver_id);
CREATE INDEX messages_item_id_idx ON messages(item_id);