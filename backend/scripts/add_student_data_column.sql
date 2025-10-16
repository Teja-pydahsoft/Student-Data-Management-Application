-- Add missing student_data JSON column to students table
-- Run this script to fix the database schema

USE student_database;

-- Add the missing student_data JSON column
ALTER TABLE students
ADD COLUMN IF NOT EXISTS student_data JSON AFTER custom_fields;

-- Add the missing admission_no column (this fixes the approval error)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS admission_no VARCHAR(100) NULL AFTER admission_number;

-- Add index for admission_no for better query performance
ALTER TABLE students
ADD INDEX IF NOT EXISTS idx_admission_no (admission_no);

-- Verify the columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'student_database'
AND TABLE_NAME = 'students'
AND COLUMN_NAME IN ('student_data', 'admission_no');

SELECT 'student_data and admission_no columns added successfully!' as status;
