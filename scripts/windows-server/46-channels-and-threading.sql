-- =====================================================
-- 46: Chat Channels, Threading, Reactions & Voice
-- Upgrades stick_chats to support persistent channels,
-- message threading, reactions, editing, and voice rooms
-- =====================================================

-- =====================================================
-- 1. CHANNEL SUPPORT - Extend stick_chats
-- =====================================================

-- Add channel-specific columns to stick_chats
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'chat'
  CHECK (chat_type IN ('chat', 'channel', 'voice'));
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private'
  CHECK (visibility IN ('public', 'private'));
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS pinned_message_ids UUID[] DEFAULT '{}';
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Channel categories for organizing channels in sidebar
CREATE TABLE IF NOT EXISTS channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK for category_id (after table created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_stick_chats_category'
  ) THEN
    ALTER TABLE stick_chats
      ADD CONSTRAINT fk_stick_chats_category
      FOREIGN KEY (category_id) REFERENCES channel_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Member roles within channels
ALTER TABLE stick_chat_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'
  CHECK (role IN ('admin', 'member', 'readonly'));

-- Indexes for channels
CREATE INDEX IF NOT EXISTS idx_stick_chats_type ON stick_chats(chat_type);
CREATE INDEX IF NOT EXISTS idx_stick_chats_visibility ON stick_chats(visibility) WHERE chat_type = 'channel';
CREATE INDEX IF NOT EXISTS idx_stick_chats_category ON stick_chats(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stick_chats_archived ON stick_chats(is_archived) WHERE is_archived = true;
CREATE INDEX IF NOT EXISTS idx_channel_categories_org ON channel_categories(org_id);

-- =====================================================
-- 2. MESSAGE THREADING
-- =====================================================

ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS parent_message_id UUID
  REFERENCES stick_chat_messages(id) ON DELETE SET NULL;
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS thread_reply_count INTEGER DEFAULT 0;
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS thread_last_reply_at TIMESTAMPTZ;

-- Index for thread lookups
CREATE INDEX IF NOT EXISTS idx_stick_chat_messages_parent ON stick_chat_messages(parent_message_id)
  WHERE parent_message_id IS NOT NULL;

-- Trigger to update thread counters on parent when reply is added
CREATE OR REPLACE FUNCTION update_thread_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_message_id IS NOT NULL THEN
    UPDATE stick_chat_messages
    SET thread_reply_count = thread_reply_count + 1,
        thread_last_reply_at = NOW()
    WHERE id = NEW.parent_message_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_thread_reply_insert ON stick_chat_messages;
CREATE TRIGGER trigger_thread_reply_insert
  AFTER INSERT ON stick_chat_messages
  FOR EACH ROW
  WHEN (NEW.parent_message_id IS NOT NULL)
  EXECUTE FUNCTION update_thread_counters();

-- =====================================================
-- 3. MESSAGE REACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES stick_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);

-- =====================================================
-- 4. MESSAGE EDITING & FORWARDING
-- =====================================================

ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS edit_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS forwarded_from_id UUID
  REFERENCES stick_chat_messages(id) ON DELETE SET NULL;
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS quoted_message_id UUID
  REFERENCES stick_chat_messages(id) ON DELETE SET NULL;
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text'
  CHECK (message_type IN ('text', 'system', 'file', 'image'));
ALTER TABLE stick_chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Index for quoted message lookups
CREATE INDEX IF NOT EXISTS idx_stick_chat_messages_quoted ON stick_chat_messages(quoted_message_id)
  WHERE quoted_message_id IS NOT NULL;

-- =====================================================
-- 5. VOICE CHANNELS (LiveKit integration)
-- =====================================================

-- Link voice channels to LiveKit rooms
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS livekit_room_name TEXT;
ALTER TABLE stick_chats ADD COLUMN IF NOT EXISTS voice_active_participants INTEGER DEFAULT 0;

-- Track who is currently in a voice channel
CREATE TABLE IF NOT EXISTS voice_channel_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES stick_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT false,
  is_deafened BOOLEAN DEFAULT false,
  UNIQUE(channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_voice_participants_channel ON voice_channel_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_voice_participants_user ON voice_channel_participants(user_id);

-- =====================================================
-- 6. TYPING INDICATORS (ephemeral, via table for fallback)
-- =====================================================

CREATE TABLE IF NOT EXISTS typing_indicators (
  chat_id UUID NOT NULL REFERENCES stick_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- Auto-expire typing indicators older than 10 seconds
CREATE INDEX IF NOT EXISTS idx_typing_indicators_expire ON typing_indicators(started_at);

-- =====================================================
-- 7. PINNED MESSAGES TABLE (more flexible than array)
-- =====================================================

CREATE TABLE IF NOT EXISTS pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES stick_chats(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES stick_chat_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_messages_chat ON pinned_messages(chat_id);

-- =====================================================
-- 8. UPDATE COMMENTS
-- =====================================================

COMMENT ON COLUMN stick_chats.chat_type IS 'chat = standard chat, channel = persistent team channel, voice = audio-only room';
COMMENT ON COLUMN stick_chats.visibility IS 'public = any org member can join, private = invite only';
COMMENT ON COLUMN stick_chats.description IS 'Channel description shown in channel browser';
COMMENT ON COLUMN stick_chats.topic IS 'Current channel topic, shown in header';
COMMENT ON COLUMN stick_chats.category_id IS 'Category for sidebar organization';
COMMENT ON COLUMN stick_chats.livekit_room_name IS 'LiveKit room name for voice channels';
COMMENT ON TABLE channel_categories IS 'Organizes channels into collapsible groups in sidebar';
COMMENT ON TABLE message_reactions IS 'Emoji reactions on chat messages';
COMMENT ON TABLE voice_channel_participants IS 'Tracks who is currently connected to a voice channel';
COMMENT ON TABLE typing_indicators IS 'Ephemeral typing status, primarily delivered via WebSocket';
COMMENT ON TABLE pinned_messages IS 'Messages pinned in a channel for quick reference';
COMMENT ON COLUMN stick_chat_messages.parent_message_id IS 'Parent message ID for threaded replies';
COMMENT ON COLUMN stick_chat_messages.edit_history IS 'JSON array of previous versions [{content, edited_at}]';
COMMENT ON COLUMN stick_chat_messages.message_type IS 'text=normal, system=join/leave, file=attachment, image=inline image';
COMMENT ON COLUMN stick_chat_members.role IS 'admin=can manage, member=normal, readonly=view only';
