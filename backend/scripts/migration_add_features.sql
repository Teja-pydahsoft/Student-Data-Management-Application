-- Migration script to add new features
-- Run this script to update existing database

USE student_database;

-- Add new columns to form_submissions table
ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS submitted_by ENUM('student', 'admin') DEFAULT 'student' AFTER status,
ADD COLUMN IF NOT EXISTS submitted_by_admin INT NULL AFTER submitted_by,
ADD INDEX IF NOT EXISTS idx_submitted_by (submitted_by);

-- Add foreign key for submitted_by_admin if not exists
ALTER TABLE form_submissions 
ADD CONSTRAINT fk_submitted_by_admin 
FOREIGN KEY (submitted_by_admin) REFERENCES admins(id) ON DELETE SET NULL;

-- Note: pin_no column is the standard for student identification
-- This script ensures pin_no column exists
ALTER TABLE students
ADD COLUMN IF NOT EXISTS pin_no VARCHAR(50) NULL,
ADD INDEX IF NOT EXISTS idx_pin_no (pin_no);

-- Update existing records to have 'student' as submitted_by
UPDATE form_submissions SET submitted_by = 'student' WHERE submitted_by IS NULL;

SELECT 'Migration completed successfully!' as status;
