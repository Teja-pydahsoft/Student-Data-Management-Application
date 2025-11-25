-- ============================================================================
-- Migration: RBAC User Management System
-- ============================================================================
-- 
-- PURPOSE: Create comprehensive user management with role-based access control
--          following college → course → branch hierarchy
-- DATE: 2025-01-XX
--
-- This migration creates a new users table with:
-- - Multi-level roles (Super Admin, Campus Principal, Course Principal, HOD, AO)
-- - College/Course/Branch scoping
-- - Module-wise Read/Write permissions
-- ============================================================================
-- Note: Database name will be replaced dynamically by the migration script
-- ============================================================================

-- ============================================================================
-- PHASE 1: Create RBAC Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbac_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM(
    'super_admin',
    'campus_principal',
    'college_ao',
    'course_principal',
    'course_ao',
    'hod'
  ) NOT NULL,
  college_id INT NULL,
  course_id INT NULL,
  branch_id INT NULL,
  permissions JSON NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username),
  INDEX idx_role (role),
  INDEX idx_college_id (college_id),
  INDEX idx_course_id (course_id),
  INDEX idx_branch_id (branch_id),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES course_branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PHASE 2: Add Constraints and Validation
-- ============================================================================

-- Ensure role-specific constraints are enforced at application level:
-- - super_admin: college_id, course_id, branch_id must be NULL
-- - campus_principal: college_id required, course_id and branch_id must be NULL
-- - college_ao: college_id required, course_id and branch_id must be NULL
-- - course_principal: college_id and course_id required, branch_id must be NULL
-- - course_ao: college_id and course_id required, branch_id must be NULL
-- - hod: college_id, course_id, and branch_id all required

-- ============================================================================
-- PHASE 3: Create Default Super Admin (Optional - use seed script instead)
-- ============================================================================

-- Note: Super admin should be created via seed script with proper password hashing
-- This is just a placeholder structure:
-- INSERT INTO rbac_users (name, email, username, password, role, permissions)
-- VALUES (
--   'Super Admin',
--   'admin@pydah.edu',
--   'superadmin',
--   '$2a$10$...', -- Hashed password
--   'super_admin',
--   '{"pre_registration": {"read": true, "write": true}, ...}'
-- );

-- ============================================================================
-- PHASE 4: Migration Complete
-- ============================================================================

SELECT 'RBAC users table created successfully' AS status;

