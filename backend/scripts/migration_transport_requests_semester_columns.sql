-- Migration: Add semester/academic year columns to transport_requests
-- Run this if your transport_requests table already exists but lacks these columns.

USE student_database;

-- Add columns if not present (run each ALTER separately; ignore errors if column already exists)
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS semester_id INT NULL;
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS semester_start_date DATE NULL;
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS semester_end_date DATE NULL;
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS academic_year_id INT NULL;
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS year_of_study TINYINT NULL;
ALTER TABLE transport_requests ADD COLUMN IF NOT EXISTS semester_number TINYINT NULL;

-- Optional: indexes for filtering by semester/academic year
-- CREATE INDEX IF NOT EXISTS idx_transport_semester_id ON transport_requests(semester_id);
-- CREATE INDEX IF NOT EXISTS idx_transport_academic_year_id ON transport_requests(academic_year_id);
