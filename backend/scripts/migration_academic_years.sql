-- Migration: Add academic_years table and update course_branches
-- Run this migration to add academic year support

-- Create academic_years table
CREATE TABLE IF NOT EXISTS academic_years (
  id INT PRIMARY KEY AUTO_INCREMENT,
  year_label VARCHAR(20) NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_year_label (year_label),
  INDEX idx_is_active (is_active)
);

-- Add academic_year_id column to course_branches if not exists
-- This links branches to specific academic years
ALTER TABLE course_branches
ADD COLUMN IF NOT EXISTS academic_year_id INT NULL,
ADD CONSTRAINT fk_branch_academic_year
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
  ON DELETE SET NULL;

-- Add index for academic year lookups
CREATE INDEX IF NOT EXISTS idx_branch_academic_year ON course_branches(academic_year_id);

-- Insert some default academic years
INSERT IGNORE INTO academic_years (year_label, start_date, end_date, is_active) VALUES
('2024', '2024-06-01', '2025-05-31', TRUE),
('2025', '2025-06-01', '2026-05-31', TRUE),
('2026', '2026-06-01', '2027-05-31', TRUE);

