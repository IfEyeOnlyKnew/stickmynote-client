-- =====================================================
-- 57: Alter stick_chats to allow 'pad' stick_type
-- Adds 'pad' to the stick_type CHECK constraint so
-- chats can be linked to pad sticks
-- =====================================================

-- Drop the existing CHECK constraint and recreate with 'pad' included
ALTER TABLE stick_chats
  DROP CONSTRAINT IF EXISTS stick_chats_stick_type_check;

ALTER TABLE stick_chats
  ADD CONSTRAINT stick_chats_stick_type_check
  CHECK (stick_type IN ('personal', 'social', 'pad') OR stick_type IS NULL);
