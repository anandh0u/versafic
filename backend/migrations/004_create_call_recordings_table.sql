-- Create call_recordings table for Twilio call handling
CREATE TABLE IF NOT EXISTS call_recordings (
  id SERIAL PRIMARY KEY,
  call_sid VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(20) NOT NULL,
  recording_url TEXT NOT NULL,
  duration INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on call_sid for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_sid ON call_recordings(call_sid);

-- Create index on phone_number for analytics
CREATE INDEX IF NOT EXISTS idx_call_recordings_phone_number ON call_recordings(phone_number);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_recordings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS call_recordings_timestamp_trigger ON call_recordings;
CREATE TRIGGER call_recordings_timestamp_trigger
BEFORE UPDATE ON call_recordings
FOR EACH ROW
EXECUTE FUNCTION update_call_recordings_timestamp();