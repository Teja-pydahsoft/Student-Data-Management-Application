-- Performance Optimization Indexes
-- Run this script to add indexes for faster queries

USE student_database;

-- Composite indexes for common filter combinations
ALTER TABLE students 
ADD INDEX idx_course_branch_batch (course, branch, batch),
ADD INDEX idx_status_year_semester (student_status, current_year, current_semester),
ADD INDEX idx_college_course (college, course),
ADD INDEX idx_batch_year_semester (batch, current_year, current_semester),
ADD INDEX idx_created_at (created_at),
ADD INDEX idx_updated_at (updated_at);

-- Index for JSON field searches (student_data)
-- Note: MySQL 5.7+ supports generated columns for JSON indexing
ALTER TABLE students
ADD INDEX idx_student_name (student_name(100)),
ADD INDEX idx_student_mobile (student_mobile),
ADD INDEX idx_admission_date (admission_date);

-- Index for common filter fields
ALTER TABLE students
ADD INDEX idx_student_status (student_status),
ADD INDEX idx_stud_type (stud_type),
ADD INDEX idx_scholar_status (scholar_status),
ADD INDEX idx_current_year (current_year),
ADD INDEX idx_current_semester (current_semester);

-- Composite index for attendance queries
ALTER TABLE attendance_records
ADD INDEX idx_student_date_status (student_id, attendance_date, status);

-- Index for fee queries
CREATE TABLE IF NOT EXISTS student_fees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  fee_header_id INT,
  amount DECIMAL(10, 2),
  year TINYINT,
  semester TINYINT,
  paid_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student_fee (student_id, fee_header_id),
  INDEX idx_year_semester (year, semester),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Index for audit logs queries
ALTER TABLE audit_logs
ADD INDEX idx_admin_created (admin_id, created_at),
ADD INDEX idx_entity_created (entity_type, entity_id, created_at);

-- ==========================================
-- LOGIN PERFORMANCE INDEXES (CRITICAL)
-- ==========================================

-- Indexes for Admin Login
ALTER TABLE admins ADD INDEX idx_admin_username (username);

-- Indexes for RBAC/Staff Login
ALTER TABLE rbac_users ADD INDEX idx_rbac_username (username);
ALTER TABLE rbac_users ADD INDEX idx_rbac_email (email);
ALTER TABLE staff_users ADD INDEX idx_staff_username (username);

-- Indexes for Student Login and Credentials
ALTER TABLE student_credentials ADD INDEX idx_sc_username (username);
ALTER TABLE student_credentials ADD INDEX idx_sc_admission_number (admission_number);

-- Ensure Students table has admission_number index (often unique, but good to ensure)
ALTER TABLE students ADD INDEX idx_std_admission_number (admission_number);

-- Full-text search index for student search (optional, for better search performance)
-- ALTER TABLE students ADD FULLTEXT INDEX ft_student_search (student_name, admission_number, pin_no, student_data);
