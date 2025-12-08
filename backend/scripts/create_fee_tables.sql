-- ============================================================================
-- Migration: Create Fee Management Tables
-- ============================================================================
-- 
-- PURPOSE: Create tables for fee header configuration and student fee records
-- STATUS: Ready to execute
-- DATE: 2025-01-XX
--
-- TABLES:
--   1. fee_headers - Stores configurable fee types (tuition fee, bus fee, etc.)
--   2. student_fees - Stores individual fee records for each student
--
-- ============================================================================

USE student_database;

-- ============================================================================
-- PHASE 1: Create Fee Headers Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS fee_headers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  header_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  INDEX idx_header_name (header_name),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PHASE 2: Create Student Fees Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_fees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  fee_header_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  due_date DATE,
  payment_date DATE,
  payment_status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT,
  updated_by INT,
  INDEX idx_student_id (student_id),
  INDEX idx_fee_header_id (fee_header_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_due_date (due_date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (fee_header_id) REFERENCES fee_headers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PHASE 3: Insert Default Fee Headers
-- ============================================================================

INSERT IGNORE INTO fee_headers (header_name, description, is_active) VALUES
('Tuition Fee', 'Regular tuition fee for the academic period', TRUE),
('Bus Fee', 'Transportation fee for bus service', TRUE),
('CRT Fee', 'CRT examination fee', TRUE),
('Library Fee', 'Library access and maintenance fee', TRUE),
('Lab Fee', 'Laboratory usage and maintenance fee', TRUE),
('Sports Fee', 'Sports and recreation facility fee', TRUE),
('Hostel Fee', 'Hostel accommodation fee', TRUE),
('Mess Fee', 'Mess and dining facility fee', TRUE);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check: fee_headers table should exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - fee_headers table created'
    ELSE 'FAIL - fee_headers table not found'
  END AS migration_status
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'fee_headers';

-- Check: student_fees table should exist
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - student_fees table created'
    ELSE 'FAIL - student_fees table not found'
  END AS migration_status
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'student_fees';

-- Check: Default fee headers should be inserted
SELECT 
  CASE 
    WHEN COUNT(*) >= 8 THEN 'PASS - Default fee headers inserted'
    ELSE 'FAIL - Default fee headers not found'
  END AS migration_status
FROM fee_headers;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Fee management tables created successfully!' as status;
