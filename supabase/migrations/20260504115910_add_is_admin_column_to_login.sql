/*
  # Add is_admin column to login table

  1. Changes
    - Add `is_admin` boolean column to `login` table with default false
  2. Notes
    - Safe additive migration using IF NOT EXISTS check
    - Existing rows will get the default value of false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE login ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;
