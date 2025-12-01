-- Migration: Create document_requirements table in MySQL
-- Run this SQL in your MySQL database (master database)
-- 
-- This table stores document requirements configuration for student registration forms
-- based on course type (UG/PG) and academic stage (10th, Inter, Diploma, UG)

-- Create document_requirements table
CREATE TABLE IF NOT EXISTS document_requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_type VARCHAR(10) NOT NULL,
  academic_stage VARCHAR(50) NOT NULL,
  required_documents JSON NOT NULL DEFAULT ('[]'),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_course_stage (course_type, academic_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_requirements_course_type 
ON document_requirements(course_type);

CREATE INDEX IF NOT EXISTS idx_document_requirements_academic_stage 
ON document_requirements(academic_stage);

CREATE INDEX IF NOT EXISTS idx_document_requirements_enabled 
ON document_requirements(is_enabled);

-- Add constraints (MySQL doesn't support CHECK constraints in older versions, so we validate in application)
-- course_type must be 'UG' or 'PG'
-- academic_stage must be '10th', 'Inter', 'Diploma', or 'UG'
