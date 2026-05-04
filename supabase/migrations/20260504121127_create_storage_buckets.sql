/*
  # Create storage buckets

  1. Buckets
    - `image-uploads` - for user-uploaded input images (public)
    - `replicate-images` - for storing AI-generated outputs permanently (public)

  2. Policies
    - Both buckets allow public read and anon/authenticated upload
*/

-- image-uploads bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'image-uploads',
  'image-uploads',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- replicate-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'replicate-images',
  'replicate-images',
  true,
  104857600
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for image-uploads
CREATE POLICY "Public read image-uploads"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'image-uploads');

CREATE POLICY "Anon can upload image-uploads"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'image-uploads');

CREATE POLICY "Anon can delete image-uploads"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'image-uploads');

-- Storage policies for replicate-images
CREATE POLICY "Public read replicate-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'replicate-images');

CREATE POLICY "Anon can upload replicate-images"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'replicate-images');

CREATE POLICY "Anon can delete replicate-images"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'replicate-images');
