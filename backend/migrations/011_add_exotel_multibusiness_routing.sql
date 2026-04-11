-- Migration: 011_add_exotel_multibusiness_routing.sql
-- Description: Add Exotel-ready multi-business session routing tables and columns

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    owner_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS ai_prompt TEXT,
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

UPDATE businesses
SET
    name = COALESCE(NULLIF(name, ''), business_name, owner_name, email, 'Business'),
    phone_number = COALESCE(NULLIF(phone_number, ''), phone)
WHERE name IS NULL
   OR name = ''
   OR phone_number IS NULL
   OR phone_number = '';

CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);
CREATE INDEX IF NOT EXISTS idx_businesses_phone_number ON businesses(phone_number);

CREATE TABLE IF NOT EXISTS customer_business_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_phone VARCHAR(20) NOT NULL,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    last_interaction TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customer_business_mapping_unique UNIQUE (customer_phone, business_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_business_mapping_phone
    ON customer_business_mapping(customer_phone);

CREATE INDEX IF NOT EXISTS idx_customer_business_mapping_business
    ON customer_business_mapping(business_id);

CREATE INDEX IF NOT EXISTS idx_customer_business_mapping_last_interaction
    ON customer_business_mapping(last_interaction DESC);

CREATE OR REPLACE FUNCTION update_customer_business_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_business_mapping_timestamp_trigger ON customer_business_mapping;
CREATE TRIGGER customer_business_mapping_timestamp_trigger
    BEFORE UPDATE ON customer_business_mapping
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_business_mapping_timestamp();

ALTER TABLE call_sessions
    ALTER COLUMN call_sid DROP NOT NULL;

ALTER TABLE call_sessions
    ADD COLUMN IF NOT EXISTS session_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS customer_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'twilio',
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS route_source VARCHAR(30),
    ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE call_sessions
SET session_id = gen_random_uuid()::text
WHERE session_id IS NULL;

UPDATE call_sessions
SET customer_number = COALESCE(customer_number, phone_number, to_number, from_number)
WHERE customer_number IS NULL;

UPDATE call_sessions
SET provider = COALESCE(NULLIF(provider, ''), 'twilio')
WHERE provider IS NULL
   OR provider = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_session_id
    ON call_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_call_sessions_business_id
    ON call_sessions(business_id);

CREATE INDEX IF NOT EXISTS idx_call_sessions_customer_number
    ON call_sessions(customer_number);

CREATE INDEX IF NOT EXISTS idx_call_sessions_provider
    ON call_sessions(provider);

ALTER TABLE call_recordings
    ADD COLUMN IF NOT EXISTS call_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

UPDATE call_recordings
SET call_id = COALESCE(call_id, call_sid)
WHERE call_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_call_recordings_call_id
    ON call_recordings(call_id);

CREATE INDEX IF NOT EXISTS idx_call_recordings_business_id
    ON call_recordings(business_id);
