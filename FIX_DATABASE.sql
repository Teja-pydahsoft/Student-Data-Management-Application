-- Quick fix for database columns
-- Run this in MySQL Workbench or command line

USE student_database;

-- Add missing columns to form_submissions
ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS submitted_by ENUM('student', 'admin') DEFAULT 'student' AFTER status;

ALTER TABLE form_submissions 
ADD COLUMN IF NOT EXISTS submitted_by_admin INT NULL AFTER submitted_by;

-- Add foreign key
ALTER TABLE form_submissions 
ADD CONSTRAINT fk_submitted_by_admin 
FOREIGN KEY (submitted_by_admin) REFERENCES admins(id) ON DELETE SET NULL;

-- Add index
ALTER TABLE form_submissions 
ADD INDEX IF NOT EXISTS idx_submitted_by (submitted_by);

-- Note: pin_no column is the standard for student identification
-- This script ensures pin_no column exists
ALTER TABLE students
ADD COLUMN IF NOT EXISTS pin_no VARCHAR(50) NULL;

ALTER TABLE students
ADD INDEX IF NOT EXISTS idx_pin_no (pin_no);

-- Update existing records
UPDATE form_submissions SET submitted_by = 'student' WHERE submitted_by IS NULL;

SELECT 'Database fixed successfully!' as status;
