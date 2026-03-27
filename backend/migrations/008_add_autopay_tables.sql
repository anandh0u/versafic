-- Migration: 008_add_autopay_tables.sql
-- Description: Add autopay settings/attempts and expand billing transaction sources

ALTER TABLE credit_transactions
    DROP CONSTRAINT IF EXISTS credit_transactions_source_check;

ALTER TABLE credit_transactions
    ADD CONSTRAINT credit_transactions_source_check CHECK (
        source IN (
            'razorpay',
            'autopay',
            'ai_chat',
            'sarvam_stt',
            'voice_process',
            'voice_call',
            'premium_call',
            'recording_process',
            'onboarding_ai_setup',
            'admin',
            'system'
        )
    );

CREATE TABLE IF NOT EXISTS autopay_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    selected_plan VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('low_balance', 'plan_expiry')),
    threshold_credits INTEGER NOT NULL DEFAULT 100 CHECK (threshold_credits >= 0),
    payment_method_reference VARCHAR(255),
    last_autopay_at TIMESTAMP WITH TIME ZONE,
    next_autopay_attempt_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'needs_attention')),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT autopay_settings_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS autopay_attempts (
    id SERIAL PRIMARY KEY,
    autopay_settings_id INTEGER NOT NULL REFERENCES autopay_settings(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    selected_plan VARCHAR(50) NOT NULL,
    credits_added INTEGER NOT NULL DEFAULT 0 CHECK (credits_added >= 0),
    amount_paise INTEGER NOT NULL DEFAULT 0 CHECK (amount_paise >= 0),
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    triggered_by VARCHAR(30) NOT NULL CHECK (triggered_by IN ('low_balance', 'plan_expiry', 'manual_retry')),
    razorpay_payment_id VARCHAR(255),
    failure_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_autopay_settings_user_id ON autopay_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_autopay_settings_enabled ON autopay_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_autopay_attempts_user_id ON autopay_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_autopay_attempts_status ON autopay_attempts(status);
CREATE INDEX IF NOT EXISTS idx_autopay_attempts_created_at ON autopay_attempts(created_at DESC);

DROP TRIGGER IF EXISTS update_autopay_settings_timestamp ON autopay_settings;
CREATE TRIGGER update_autopay_settings_timestamp
    BEFORE UPDATE ON autopay_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_timestamp();
