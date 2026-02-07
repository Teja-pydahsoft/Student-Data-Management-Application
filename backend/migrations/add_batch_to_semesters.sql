-- Add batch column to semesters table
-- Batch = year when students joined (e.g. 2026). Stored explicitly so form selection matches table display.
-- Migration runner ignores ER_DUP_FIELDNAME if column already exists.

USE student_database;

ALTER TABLE semesters ADD COLUMN batch VARCHAR(20) NULL AFTER year_of_study;

UPDATE semesters s
INNER JOIN academic_years ay ON s.academic_year_id = ay.id
SET s.batch = CAST(SUBSTRING(TRIM(REPLACE(ay.year_label, ' ', '')), 1, 4) AS UNSIGNED) - s.year_of_study + 1
WHERE s.batch IS NULL AND ay.year_label IS NOT NULL AND ay.year_label != '' AND LENGTH(TRIM(ay.year_label)) >= 4;
