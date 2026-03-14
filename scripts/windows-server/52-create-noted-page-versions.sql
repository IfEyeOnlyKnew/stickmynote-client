-- Migration 52: Create noted_page_versions table for version history
-- Run on HOL-DC3-PGSQL (192.168.50.30)

BEGIN;

CREATE TABLE IF NOT EXISTS noted_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES noted_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_noted_page_versions_page_id ON noted_page_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_noted_page_versions_page_created ON noted_page_versions(page_id, created_at DESC);

-- Unique constraint on page_id + version_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_noted_page_versions_page_version ON noted_page_versions(page_id, version_number);

COMMIT;

-- Verify
SELECT 'noted_page_versions table created' AS status;
SELECT count(*) AS version_count FROM noted_page_versions;
