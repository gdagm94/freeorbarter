/*
  # Storage Policies Setup

  1. Security
    - Set up policies for avatar images:
      - Public read access
      - Authenticated users can upload images
    - Set up policies for item images:
      - Public read access
      - Authenticated users can upload images
    - Allow users to delete their own uploads

  2. Changes
    - Create policies for avatar image access and upload
    - Create policies for item image access and upload
    - Create policy for users to delete their own uploads
*/

-- Set up storage policies for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar images" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatar images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (LOWER(SUBSTRING(name FROM '\.([^\.]+)$')) IN ('jpg', 'jpeg', 'png', 'gif'))
);

-- Set up storage policies for item images
DROP POLICY IF EXISTS "Item images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload item images" ON storage.objects;

CREATE POLICY "Item images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-images');

CREATE POLICY "Users can upload item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images' AND
  (LOWER(SUBSTRING(name FROM '\.([^\.]+)$')) IN ('jpg', 'jpeg', 'png', 'gif'))
);

-- Allow users to delete their own uploads
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

CREATE POLICY "Users can delete own uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (owner = auth.uid());