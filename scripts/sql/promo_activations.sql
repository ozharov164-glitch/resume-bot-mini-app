-- Supabase / Postgres migration for bot promo activation tracking.
-- Run once in SQL editor if promo activation fails on production.

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_promo_code TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS promo_activated_at TIMESTAMPTZ DEFAULT NULL;

CREATE TABLE IF NOT EXISTS promo_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code TEXT NOT NULL,
    owner_tg_id BIGINT DEFAULT NULL,
    user_tg_id BIGINT NOT NULL,
    activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ DEFAULT NULL,
    resume_id TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_promo_act_user ON promo_activations(user_tg_id);
CREATE INDEX IF NOT EXISTS idx_promo_act_code ON promo_activations(promo_code);
