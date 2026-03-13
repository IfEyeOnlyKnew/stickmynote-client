-- =====================================================
-- Stick My Note - PostgreSQL Migration Script
-- Part 48: Note Deletions Tracking (for delta sync)
-- =====================================================
-- Server: HOL-DC3-PGSQL (192.168.50.30)
-- Database: stickmynote
-- Run Order: 48
-- Purpose: Track deleted note IDs so clients can sync
--          deletions that happened while they were offline.
--          Rows auto-expire after 7 days via cleanup.
-- =====================================================

CREATE TABLE IF NOT EXISTS note_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    user_id UUID NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_note_deletions_user_deleted ON note_deletions(user_id, deleted_at);

-- Cleanup: Remove entries older than 7 days (run periodically via pgAgent or cron)
-- DELETE FROM note_deletions WHERE deleted_at < NOW() - INTERVAL '7 days';
