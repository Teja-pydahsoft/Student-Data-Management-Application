-- Migration: Course and Branch configuration support
-- Run this script to add course configuration tables and columns

USE student_database;

-- Add course column to master students table if it does not exist
SET @add_master_course_column_stmt := IF(
  EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'students'
      AND COLUMN_NAME = 'course'
  ),
  'SELECT "course column already present on students (master)"',
  'ALTER TABLE students ADD COLUMN course VARCHAR(100) AFTER batch;'
);
PREPARE stmt FROM @add_master_course_column_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for course column
SET @add_master_course_index_stmt := IF(
  EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'students'
      AND INDEX_NAME = 'idx_course'
  ),
  'SELECT "idx_course index already present on students (master)"',
  'ALTER TABLE students ADD INDEX idx_course (course);'
);
PREPARE stmt FROM @add_master_course_index_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  total_years TINYINT NOT NULL DEFAULT 4,
  semesters_per_year TINYINT NOT NULL DEFAULT 2,
  metadata JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_course_name (name),
  UNIQUE KEY unique_course_code (code)
);

-- Create course branches table
CREATE TABLE IF NOT EXISTS course_branches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  total_years TINYINT,
  semesters_per_year TINYINT,
  metadata JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_branch_per_course (course_id, name),
  UNIQUE KEY unique_branch_code_per_course (course_id, code),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

