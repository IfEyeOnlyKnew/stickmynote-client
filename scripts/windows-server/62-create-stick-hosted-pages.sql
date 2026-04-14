-- Hosted article pages generated from Sticks via Ollama.
-- Each row captures an Ollama-generated HostedArticleData JSON for a specific stick,
-- plus a public slug for the /hosted/[slug] route.

DROP TABLE IF EXISTS stick_hosted_pages CASCADE;

CREATE TABLE stick_hosted_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stick_id UUID NOT NULL,
    stick_kind VARCHAR NOT NULL DEFAULT 'personal', -- 'personal' | 'pad' | 'concur'
    slug VARCHAR NOT NULL UNIQUE,
    generated_by UUID NOT NULL,
    article_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stick_hosted_pages_stick ON stick_hosted_pages(stick_id);
CREATE INDEX idx_stick_hosted_pages_slug ON stick_hosted_pages(slug);
CREATE INDEX idx_stick_hosted_pages_user ON stick_hosted_pages(generated_by);
