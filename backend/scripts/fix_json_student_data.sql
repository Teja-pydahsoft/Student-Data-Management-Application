-- Fix for MySQL JSON column issues in student_data
-- This script addresses the "Invalid JSON text" error

USE student_database;

-- Check current student_data column structure
DESCRIBE students;

-- Option 1: Modify the student_data column to use TEXT instead of JSON
-- This avoids MySQL JSON parsing issues while preserving data storage
ALTER TABLE students MODIFY COLUMN student_data TEXT;

-- Option 2: If you prefer to keep JSON, ensure proper encoding
-- ALTER TABLE students MODIFY COLUMN student_data JSON CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Option 3: Add a new TEXT column as backup and copy data
-- ALTER TABLE students ADD COLUMN student_data_text TEXT;
-- UPDATE students SET student_data_text = student_data WHERE student_data IS NOT NULL;

-- Verify the changes
SELECT
    column_name,
    data_type,
    character_set_name,
    collation_name
FROM information_schema.columns
WHERE table_schema = 'student_database'
AND table_name = 'students'
AND column_name = 'student_data';

-- Test with a simple insert (run this manually if needed)
-- INSERT INTO students (admission_number, student_name, student_data)
-- VALUES ('TEST001', 'Test Student', '{"test": "data", "valid": true}');