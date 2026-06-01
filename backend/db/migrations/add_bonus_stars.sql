-- Referral bonus balance in Telegram Stars (discount on next payment).
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_stars INTEGER DEFAULT 0;
