-- Migration: 012_create_bookings_table.sql
-- Description: Persist AI-captured booking and appointment requests

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'manual',
    source_session_id VARCHAR(255),
    source_call_sid VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    service VARCHAR(255) NOT NULL DEFAULT 'Appointment',
    appointment_date DATE,
    appointment_time TIME,
    appointment_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    notes TEXT,
    raw_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_source_session
    ON bookings(source, source_session_id)
    WHERE source_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_user_created
    ON bookings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_business_created
    ON bookings(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_appointment_at
    ON bookings(appointment_at);

CREATE INDEX IF NOT EXISTS idx_bookings_status
    ON bookings(status);

CREATE OR REPLACE FUNCTION update_bookings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_timestamp_trigger ON bookings;
CREATE TRIGGER bookings_timestamp_trigger
    BEFORE UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION update_bookings_timestamp();
