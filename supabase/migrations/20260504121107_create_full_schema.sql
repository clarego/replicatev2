/*
  # Full schema setup

  1. New Tables
    - `login` - student/admin user accounts
      - `id` (uuid, primary key)
      - `name` (text, unique) - username
      - `password` (text) - plain text password
      - `is_admin` (boolean, default false)
      - `created_at` (timestamptz)
    - `api_secrets` - stores API keys for external services
      - `id` (uuid, primary key)
      - `key_name` (text, unique)
      - `key_value` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `student_generations` - stores AI generation records
      - `id` (uuid, primary key)
      - `student_name` (text)
      - `model_name` (text)
      - `model_version` (text)
      - `generation_type` (text) - image/video/audio/text/3d
      - `content_url` (text)
      - `thumbnail_url` (text, nullable)
      - `input_data` (jsonb)
      - `output_data` (jsonb)
      - `prediction_id` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - `login`: public SELECT (for username dropdown), no public INSERT/UPDATE/DELETE
    - `api_secrets`: no public access (service role only via edge functions)
    - `student_generations`: public SELECT and INSERT (students save and view generations)
*/

-- login table
CREATE TABLE IF NOT EXISTS login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  password text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read login names for authentication"
  ON login FOR SELECT
  TO anon, authenticated
  USING (true);

-- api_secrets table
CREATE TABLE IF NOT EXISTS api_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text UNIQUE NOT NULL,
  key_value text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_secrets ENABLE ROW LEVEL SECURITY;

-- student_generations table
CREATE TABLE IF NOT EXISTS student_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  model_name text NOT NULL DEFAULT '',
  model_version text NOT NULL DEFAULT '',
  generation_type text NOT NULL DEFAULT 'image',
  content_url text NOT NULL DEFAULT '',
  thumbnail_url text,
  input_data jsonb,
  output_data jsonb,
  prediction_id text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read student generations"
  ON student_generations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert student generations"
  ON student_generations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete student generations"
  ON student_generations FOR DELETE
  TO anon, authenticated
  USING (true);
