CREATE TABLE IF NOT EXISTS demo_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('incoming', 'outbound')),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_demo_call_sessions_user_id_created_at
  ON demo_call_sessions (user_id, created_at DESC);
