-- Migration: Add semesters table for Academic Calendar
-- This table stores semester dates for each course, academic year, year of study, and semester

USE student_database;

-- Create semesters table
CREATE TABLE IF NOT EXISTS semesters (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NULL,
  course_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  year_of_study TINYINT NOT NULL,
  semester_number TINYINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE,
  INDEX idx_college_id (college_id),
  INDEX idx_course_id (course_id),
  INDEX idx_academic_year_id (academic_year_id),
  INDEX idx_year_semester (year_of_study, semester_number),
  INDEX idx_dates (start_date, end_date),
  UNIQUE KEY unique_semester (college_id, course_id, academic_year_id, year_of_study, semester_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

