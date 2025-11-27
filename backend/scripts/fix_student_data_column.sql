-- Fix: Change student_data column from TEXT to LONGTEXT
-- TEXT can only hold 64KB, which is too small for JSON data that might include photos
-- LONGTEXT can hold up to 4GB

-- Run this migration to fix the "Data too long for column 'student_data'" error

USE student_database;

-- Alter the student_data column to LONGTEXT
ALTER TABLE students MODIFY COLUMN student_data LONGTEXT;

-- Also alter submission_data in form_submissions if needed
ALTER TABLE form_submissions MODIFY COLUMN submission_data LONGTEXT;

-- Verify the changes
DESCRIBE students;
DESCRIBE form_submissions;

