-- Chat Requests Table
-- Tracks chat invitation requests between users
-- Created for consent-based chat initiation flow

CREATE TABLE IF NOT EXISTS chat_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The reply thread this chat would continue
  parent_reply_id UUID NOT NULL REFERENCES personal_sticks_replies(id) ON DELETE CASCADE,

  -- Who sent the request
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Who should respond (the other user in the thread)
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Organization context (optional)
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Status: pending, accepted, busy, schedule_meeting, give_me_5_minutes, cancelled
  status VARCHAR(50) NOT NULL DEFAULT 'pending',

  -- Optional message from recipient (e.g., meeting link, custom response)
  response_message TEXT,

  -- Timestamp when "give_me_5_minutes" was selected (for countdown)
  wait_until TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_requests_recipient ON chat_requests(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_requester ON chat_requests(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_requests_parent_reply ON chat_requests(parent_reply_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_created_at ON chat_requests(created_at);

-- Comments for documentation
COMMENT ON TABLE chat_requests IS 'Stores chat invitation requests between users for consent-based chat initiation';
COMMENT ON COLUMN chat_requests.status IS 'pending=waiting for response, accepted=chat can start, busy=declined politely, schedule_meeting=wants to schedule, give_me_5_minutes=will be ready soon, cancelled=requester withdrew';
COMMENT ON COLUMN chat_requests.wait_until IS 'Set when status is give_me_5_minutes - timestamp when requester can proceed';
