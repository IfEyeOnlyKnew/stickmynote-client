-- Part 59: Recognition & Praise Tables
-- Description: Kudos system, badges, badge awards, leaderboards, recognition feed
-- Tables: 7 tables + indexes + seed data for default badges

-- =====================================================
-- RECOGNITION VALUES (Organization-defined core values)
-- =====================================================

CREATE TABLE IF NOT EXISTS recognition_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT NOT NULL DEFAULT '⭐',
    color TEXT NOT NULL DEFAULT '#f59e0b',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_recognition_values_org ON recognition_values(org_id);
CREATE INDEX IF NOT EXISTS idx_recognition_values_active ON recognition_values(org_id, is_active);

-- =====================================================
-- KUDOS (Individual praise/recognition entries)
-- =====================================================

CREATE TABLE IF NOT EXISTS kudos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    giver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    value_id UUID REFERENCES recognition_values(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT true,
    points INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kudos_org ON kudos(org_id);
CREATE INDEX IF NOT EXISTS idx_kudos_giver ON kudos(giver_id);
CREATE INDEX IF NOT EXISTS idx_kudos_created ON kudos(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kudos_value ON kudos(value_id);

-- =====================================================
-- KUDOS RECIPIENTS (Multiple recipients per kudos)
-- =====================================================

CREATE TABLE IF NOT EXISTS kudos_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kudos_id UUID NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(kudos_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_kudos_recipients_kudos ON kudos_recipients(kudos_id);
CREATE INDEX IF NOT EXISTS idx_kudos_recipients_user ON kudos_recipients(user_id);

-- =====================================================
-- KUDOS REACTIONS (Likes/cheers on kudos)
-- =====================================================

CREATE TABLE IF NOT EXISTS kudos_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kudos_id UUID NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'celebrate',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(kudos_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_kudos_reactions_kudos ON kudos_reactions(kudos_id);
CREATE INDEX IF NOT EXISTS idx_kudos_reactions_user ON kudos_reactions(user_id);

-- =====================================================
-- KUDOS COMMENTS (Replies on kudos)
-- =====================================================

CREATE TABLE IF NOT EXISTS kudos_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kudos_id UUID NOT NULL REFERENCES kudos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kudos_comments_kudos ON kudos_comments(kudos_id);
CREATE INDEX IF NOT EXISTS idx_kudos_comments_user ON kudos_comments(user_id);

-- =====================================================
-- BADGES (Organization-defined achievement badges)
-- =====================================================

CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT NOT NULL DEFAULT 'award',
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
    category TEXT NOT NULL DEFAULT 'general',
    criteria_type TEXT NOT NULL DEFAULT 'manual' CHECK (criteria_type IN ('manual', 'kudos_count', 'kudos_given', 'streak', 'custom')),
    criteria_threshold INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_badges_org ON badges(org_id);
CREATE INDEX IF NOT EXISTS idx_badges_active ON badges(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_badges_tier ON badges(tier);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(org_id, category);

-- =====================================================
-- BADGE AWARDS (Badges awarded to users)
-- =====================================================

CREATE TABLE IF NOT EXISTS badge_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    awarded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(badge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_awards_badge ON badge_awards(badge_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_user ON badge_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_org ON badge_awards(org_id);
CREATE INDEX IF NOT EXISTS idx_badge_awards_created ON badge_awards(org_id, created_at DESC);

-- =====================================================
-- RECOGNITION STREAKS (Track consecutive recognition)
-- =====================================================

CREATE TABLE IF NOT EXISTS recognition_streaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    streak_type TEXT NOT NULL DEFAULT 'giving' CHECK (streak_type IN ('giving', 'receiving')),
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, org_id, streak_type)
);

CREATE INDEX IF NOT EXISTS idx_recognition_streaks_user ON recognition_streaks(user_id, org_id);

-- =====================================================
-- RECOGNITION SETTINGS (Org-level feature configuration)
-- =====================================================
-- Uses organizations.settings JSONB with key 'recognition' to store:
-- {
--   "enabled": true,
--   "points_per_kudos": 1,
--   "max_kudos_per_day": 10,
--   "leaderboard_enabled": true,
--   "leaderboard_opt_in": true,
--   "manager_notifications": true,
--   "allow_self_kudos": false,
--   "require_value": false
-- }

-- =====================================================
-- LEADERBOARD STATS VIEW (Materialized for performance)
-- =====================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS recognition_leaderboard_stats;

CREATE VIEW recognition_leaderboard_stats AS
SELECT
    kr.user_id,
    k.org_id,
    COUNT(DISTINCT k.id) AS kudos_received_count,
    COALESCE(SUM(k.points), 0) AS total_points,
    (SELECT COUNT(*) FROM kudos kg WHERE kg.giver_id = kr.user_id AND kg.org_id = k.org_id) AS kudos_given_count,
    (SELECT COUNT(*) FROM badge_awards ba WHERE ba.user_id = kr.user_id AND ba.org_id = k.org_id) AS badges_earned_count,
    MAX(k.created_at) AS last_received_at
FROM kudos_recipients kr
JOIN kudos k ON k.id = kr.kudos_id
GROUP BY kr.user_id, k.org_id;

-- =====================================================
-- RECOGNITION FEED VIEW (For the recognition wall)
-- =====================================================

DROP VIEW IF EXISTS recognition_feed_view;

CREATE VIEW recognition_feed_view AS
SELECT
    k.id AS kudos_id,
    k.org_id,
    k.giver_id,
    k.message,
    k.points,
    k.is_public,
    k.value_id,
    rv.name AS value_name,
    rv.emoji AS value_emoji,
    rv.color AS value_color,
    k.created_at,
    gu.full_name AS giver_name,
    gu.avatar_url AS giver_avatar,
    json_agg(
        json_build_object(
            'user_id', ru.id,
            'full_name', ru.full_name,
            'avatar_url', ru.avatar_url
        )
    ) AS recipients,
    (SELECT COUNT(*) FROM kudos_reactions kre WHERE kre.kudos_id = k.id) AS reaction_count,
    (SELECT COUNT(*) FROM kudos_comments kc WHERE kc.kudos_id = k.id) AS comment_count
FROM kudos k
JOIN users gu ON gu.id = k.giver_id
JOIN kudos_recipients kr ON kr.kudos_id = k.id
JOIN users ru ON ru.id = kr.user_id
LEFT JOIN recognition_values rv ON rv.id = k.value_id
WHERE k.is_public = true
GROUP BY k.id, k.org_id, k.giver_id, k.message, k.points, k.is_public, k.value_id,
         rv.name, rv.emoji, rv.color, k.created_at, gu.full_name, gu.avatar_url;
