-- Migration: Add year and semester columns to attendance_records table
-- Purpose: Store academic year and semester when attendance was marked so old data
--          can be fetched by year/semester (e.g. after student promotion).
-- Runner ignores ER_DUP_FIELDNAME / ER_DUP_KEYNAME so safe to run if already applied.
-- Note: "year" is a MySQL reserved word, so column is quoted with backticks.

ALTER TABLE attendance_records ADD COLUMN `year` TINYINT UNSIGNED NULL COMMENT 'Academic year of study when attendance was marked' AFTER attendance_date;

ALTER TABLE attendance_records ADD COLUMN semester TINYINT UNSIGNED NULL COMMENT 'Semester when attendance was marked' AFTER `year`;

CREATE INDEX idx_year_semester ON attendance_records(`year`, semester);
