-- Create settings table in Supabase
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default setting for auto_assign_series
INSERT INTO settings (key, value) VALUES ('auto_assign_series', 'false') ON CONFLICT (key) DO NOTHING;