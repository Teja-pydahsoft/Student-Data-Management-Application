-- Add missing student_data JSON column to students table
-- Run this script to fix the database schema

USE student_database;

-- Add the missing student_data JSON column
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS student_data JSON AFTER custom_fields;

-- Verify the column was added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'student_database' 
AND TABLE_NAME = 'students' 
AND COLUMN_NAME = 'student_data';

SELECT 'student_data column added successfully!' as status;
