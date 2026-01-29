-- Create social_pad_messages table for embedded pad chat
-- Allows real-time communication within Social Pads

CREATE TABLE IF NOT EXISTS social_pad_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to the social pad
  social_pad_id UUID NOT NULL REFERENCES social_pads(id) ON DELETE CASCADE,

  -- Message author
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Message content (max 500 characters for quick chat)
  content TEXT NOT NULL CHECK (char_length(content) <= 500),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_social_pad_messages_pad ON social_pad_messages(social_pad_id);
CREATE INDEX IF NOT EXISTS idx_social_pad_messages_user ON social_pad_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_social_pad_messages_created_at ON social_pad_messages(created_at);

-- Add comment
COMMENT ON TABLE social_pad_messages IS 'Real-time chat messages for Social Pads - embedded channel-like communication';

-- Trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_social_pad_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_social_pad_messages_updated_at ON social_pad_messages;
CREATE TRIGGER trigger_social_pad_messages_updated_at
  BEFORE UPDATE ON social_pad_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_social_pad_messages_updated_at();
