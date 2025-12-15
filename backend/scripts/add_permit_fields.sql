-- Add permit ending date and permit remarks columns to students table
ALTER TABLE students
ADD COLUMN IF NOT EXISTS permit_ending_date DATE NULL,
ADD COLUMN IF NOT EXISTS permit_remarks TEXT NULL;

-- Add index for permit ending date for efficient queries
CREATE INDEX IF NOT EXISTS idx_permit_ending_date ON students(permit_ending_date);

