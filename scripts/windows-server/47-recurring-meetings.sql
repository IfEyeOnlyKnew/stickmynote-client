-- ============================================================================
-- RECURRING MEETINGS & MEETING ENHANCEMENTS
-- Migration 47 - Adds recurrence support to meetings
-- ============================================================================
-- Run on HOL-DC3-PGSQL (192.168.50.30)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Add recurrence columns to meetings table
-- ----------------------------------------------------------------------------

-- recurrence_rule already exists (TEXT), add structured fields
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20)
  CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'yearly'));

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1;

-- Days of week for weekly recurrence (0=Sun, 1=Mon, ..., 6=Sat) stored as JSONB array
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_days_of_week JSONB;

-- Day of month for monthly recurrence
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER;

-- End condition: either a date or a count
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recurrence_count INTEGER;

-- Parent meeting ID for recurring instances (NULL = standalone or parent)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS parent_meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE;

-- Instance date for recurring meeting instances (the specific occurrence date)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS instance_date DATE;

-- Whether this is an exception (modified instance) of a recurring series
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS is_exception BOOLEAN DEFAULT FALSE;

-- Index for parent meeting lookups
CREATE INDEX IF NOT EXISTS idx_meetings_parent ON meetings(parent_meeting_id) WHERE parent_meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_instance_date ON meetings(instance_date) WHERE instance_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meetings_recurrence_type ON meetings(recurrence_type) WHERE recurrence_type IS NOT NULL AND recurrence_type != 'none';

-- Set default for existing meetings
UPDATE meetings SET recurrence_type = 'none' WHERE recurrence_type IS NULL;

-- ----------------------------------------------------------------------------
-- Comments
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN meetings.recurrence_type IS 'Type of recurrence: none, daily, weekly, monthly, yearly';
COMMENT ON COLUMN meetings.recurrence_interval IS 'Interval between occurrences (e.g., every 2 weeks)';
COMMENT ON COLUMN meetings.recurrence_days_of_week IS 'JSONB array of day numbers for weekly recurrence [0-6]';
COMMENT ON COLUMN meetings.recurrence_day_of_month IS 'Day of month for monthly recurrence (1-31)';
COMMENT ON COLUMN meetings.recurrence_end_date IS 'When the recurring series ends (NULL = no end)';
COMMENT ON COLUMN meetings.recurrence_count IS 'Maximum number of occurrences (alternative to end_date)';
COMMENT ON COLUMN meetings.parent_meeting_id IS 'Links an instance to its parent recurring meeting';
COMMENT ON COLUMN meetings.instance_date IS 'The specific date this instance represents';
COMMENT ON COLUMN meetings.is_exception IS 'Whether this instance has been modified from the series pattern';
