-- Call sessions table for tracking call state and sessions
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid VARCHAR(64) NOT NULL UNIQUE,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  direction VARCHAR(10) DEFAULT 'inbound',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_sid VARCHAR(64),
  transcript TEXT,
  ai_response TEXT,
  metadata JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_call_sid ON call_sessions(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_sessions_from_number ON call_sessions(from_number);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_started_at ON call_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_call_sessions_direction ON call_sessions(direction);
