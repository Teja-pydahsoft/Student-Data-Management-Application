-- Add level column to courses table
ALTER TABLE courses 
ADD COLUMN level ENUM('diploma', 'ug', 'pg') DEFAULT 'ug' AFTER code;

-- Update existing courses to have a default level (ug)
UPDATE courses SET level = 'ug' WHERE level IS NULL;
