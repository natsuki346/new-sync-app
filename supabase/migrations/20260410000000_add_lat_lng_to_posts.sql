-- Add GPS coordinates to posts table
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS lat  double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lng  double precision DEFAULT NULL;
