-- Migration: 009_upgrade_autopay_and_call_compliance.sql
-- Description: Add compliant autopay controls, call consent fields, and richer call session tracking

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS call_consent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS call_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number_unique
    ON users(phone_number)
    WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_call_preferences
    ON users(call_consent, call_opt_out);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS payment_context VARCHAR(30) NOT NULL DEFAULT 'manual_topup',
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_payment_context_check;

ALTER TABLE payments
    ADD CONSTRAINT payments_payment_context_check CHECK (
        payment_context IN ('manual_topup', 'autopay')
    );

ALTER TABLE credit_transactions
    DROP CONSTRAINT IF EXISTS credit_transactions_source_check;

ALTER TABLE credit_transactions
    ADD CONSTRAINT credit_transactions_source_check CHECK (
        source IN (
            'razorpay',
            'autopay',
            'demo_autopay',
            'ai_chat',
            'sarvam_stt',
            'voice_process',
            'voice_call',
            'inbound_call',
            'outbound_call',
            'premium_call',
            'recording_process',
            'onboarding_ai_setup',
            'admin',
            'system'
        )
    );

ALTER TABLE autopay_settings
    ADD COLUMN IF NOT EXISTS recharge_amount INTEGER NOT NULL DEFAULT 19900,
    ADD COLUMN IF NOT EXISTS mode VARCHAR(10) NOT NULL DEFAULT 'demo';

ALTER TABLE autopay_settings
    DROP CONSTRAINT IF EXISTS autopay_settings_mode_check;

ALTER TABLE autopay_settings
    ADD CONSTRAINT autopay_settings_mode_check CHECK (
        mode IN ('demo', 'real')
    );

CREATE TABLE IF NOT EXISTS autopay_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('pending_checkout', 'completed', 'failed', 'skipped', 'blocked')
    ),
    triggered_reason VARCHAR(50) NOT NULL,
    mode VARCHAR(10) NOT NULL CHECK (mode IN ('demo', 'real')),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_autopay_logs_user_id
    ON autopay_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_autopay_logs_status
    ON autopay_logs(status);

CREATE INDEX IF NOT EXISTS idx_autopay_logs_timestamp
    ON autopay_logs(timestamp DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_autopay_logs_pending_checkout_unique
    ON autopay_logs(user_id)
    WHERE status = 'pending_checkout';

ALTER TABLE call_sessions
    ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'incoming',
    ADD COLUMN IF NOT EXISTS purpose VARCHAR(50),
    ADD COLUMN IF NOT EXISTS cost_credits INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS callback_requested BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parent_call_sid VARCHAR(64),
    ADD COLUMN IF NOT EXISTS status_reason TEXT;

ALTER TABLE call_sessions
    DROP CONSTRAINT IF EXISTS call_sessions_type_check;

ALTER TABLE call_sessions
    ADD CONSTRAINT call_sessions_type_check CHECK (
        type IN ('incoming', 'outgoing')
    );

UPDATE call_sessions
SET
    phone_number = CASE
        WHEN direction = 'outbound' THEN to_number
        ELSE from_number
    END,
    type = CASE
        WHEN direction = 'outbound' THEN 'outgoing'
        ELSE 'incoming'
    END
WHERE phone_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id
    ON call_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_call_sessions_phone_number
    ON call_sessions(phone_number);

CREATE INDEX IF NOT EXISTS idx_call_sessions_type
    ON call_sessions(type);
