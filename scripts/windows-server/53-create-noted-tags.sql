-- Migration 53: Create noted_tags and noted_page_tags tables
-- Run on HOL-DC3-PGSQL (192.168.50.30)

BEGIN;

-- Tags table (org-scoped)
CREATE TABLE IF NOT EXISTS noted_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  parent_id UUID REFERENCES noted_tags(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table: pages <-> tags
CREATE TABLE IF NOT EXISTS noted_page_tags (
  page_id UUID NOT NULL REFERENCES noted_pages(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES noted_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page_id, tag_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_noted_tags_org ON noted_tags(org_id);
CREATE INDEX IF NOT EXISTS idx_noted_tags_parent ON noted_tags(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_noted_tags_org_name ON noted_tags(org_id, LOWER(name));
CREATE INDEX IF NOT EXISTS idx_noted_page_tags_tag ON noted_page_tags(tag_id);

COMMIT;

-- Verify
SELECT 'noted_tags and noted_page_tags tables created' AS status;
