-- ============================================================================
-- Migration: Add Colleges Support to Student Database
-- ============================================================================
-- 
-- PURPOSE: Introduce Colleges hierarchy (College → Courses → Branches)
-- STATUS: DESIGN ONLY - DO NOT EXECUTE UNTIL APPROVED
-- DATE: 2025-01-XX
--
-- MIGRATION STRATEGY:
--   1. Create colleges table
--   2. Insert default colleges
--   3. Add nullable college_id to courses
--   4. Map existing courses to colleges
--   5. Verify data integrity
--   6. Set NOT NULL constraint
--
-- ROLLBACK: See migration_rollback_colleges.sql
-- ============================================================================

USE student_database;

-- ============================================================================
-- PHASE 1: Create Colleges Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS colleges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_college_name (name),
  UNIQUE KEY unique_college_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- PHASE 2: Insert Default Colleges
-- ============================================================================

INSERT INTO colleges (name, code, is_active) VALUES
  ('Pydah College of Engineering', 'PCE', TRUE),
  ('Pydah Degree College', 'PDC', TRUE),
  ('Pydah College of Pharmacy', 'PCP', TRUE)
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- PHASE 3: Add college_id Column to Courses (Nullable Initially)
-- ============================================================================
-- Note: Idempotency is handled in run_college_migration.js script
-- These statements will be executed only if the column/index/constraint don't exist

-- Add column (nullable)
-- ALTER TABLE courses ADD COLUMN college_id INT NULL AFTER id;

-- Add index for performance
-- CREATE INDEX idx_courses_college_id ON courses(college_id);

-- Add foreign key constraint
-- ALTER TABLE courses 
--   ADD CONSTRAINT fk_course_college 
--     FOREIGN KEY (college_id) REFERENCES colleges(id) 
--     ON DELETE SET NULL;

-- ============================================================================
-- PHASE 4: Map Existing Courses to Colleges
-- ============================================================================

-- Map B.Tech and Diploma to Engineering College
UPDATE courses 
SET college_id = (
  SELECT id FROM colleges 
  WHERE name = 'Pydah College of Engineering' 
  LIMIT 1
)
WHERE name IN ('B.Tech', 'Diploma')
  AND college_id IS NULL;

-- Map Degree to Degree College
UPDATE courses 
SET college_id = (
  SELECT id FROM colleges 
  WHERE name = 'Pydah Degree College' 
  LIMIT 1
)
WHERE name = 'Degree'
  AND college_id IS NULL;

-- Map Pharmacy to Pharmacy College
UPDATE courses 
SET college_id = (
  SELECT id FROM colleges 
  WHERE name = 'Pydah College of Pharmacy' 
  LIMIT 1
)
WHERE name = 'Pharmacy'
  AND college_id IS NULL;

-- Handle any unmapped courses (assign to Engineering as default)
UPDATE courses 
SET college_id = (
  SELECT id FROM colleges 
  WHERE name = 'Pydah College of Engineering' 
  LIMIT 1
)
WHERE college_id IS NULL;

-- ============================================================================
-- PHASE 5: Verification Queries
-- ============================================================================

-- Check: All courses should have college_id
SELECT 
  'Unmapped Courses Check' AS check_name,
  COUNT(*) AS unmapped_count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS' 
    ELSE 'FAIL - Some courses are not mapped to colleges' 
  END AS status
FROM courses 
WHERE college_id IS NULL;

-- Check: All branches should reference valid courses
SELECT 
  'Orphaned Branches Check' AS check_name,
  COUNT(*) AS orphaned_count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS' 
    ELSE 'FAIL - Some branches reference non-existent courses' 
  END AS status
FROM course_branches cb
LEFT JOIN courses c ON cb.course_id = c.id
WHERE c.id IS NULL;

-- Check: College-course mapping summary
SELECT 
  cl.name AS college_name,
  COUNT(c.id) AS total_courses,
  COUNT(CASE WHEN c.is_active = TRUE THEN 1 END) AS active_courses,
  COUNT(CASE WHEN c.is_active = FALSE THEN 1 END) AS inactive_courses
FROM colleges cl
LEFT JOIN courses c ON cl.id = c.college_id
GROUP BY cl.id, cl.name
ORDER BY cl.name;

-- Check: Student data integrity (should match pre-migration)
SELECT 
  'Student Data Check' AS check_name,
  COUNT(*) AS total_students,
  COUNT(DISTINCT course) AS unique_course_names,
  COUNT(DISTINCT branch) AS unique_branch_names
FROM students;

-- ============================================================================
-- PHASE 6: Set NOT NULL Constraint (ONLY AFTER VERIFICATION)
-- ============================================================================
-- 
-- WARNING: Only run this after verifying all courses are mapped!
-- Uncomment the following lines after Phase 5 verification passes:
--
-- ALTER TABLE courses 
--   MODIFY COLUMN college_id INT NOT NULL;
--
-- ============================================================================

-- Final verification: Confirm NOT NULL can be applied
-- SELECT 
--   CASE 
--     WHEN COUNT(*) = 0 THEN 'READY - Can set NOT NULL constraint'
--     ELSE CONCAT('NOT READY - ', COUNT(*), ' courses still have NULL college_id')
--   END AS status
-- FROM courses 
-- WHERE college_id IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- 
-- Next Steps:
--   1. Verify all checks passed
--   2. Run Phase 6 (NOT NULL constraint) if ready
--   3. Update backend controllers
--   4. Update frontend API calls
--   5. Test end-to-end
--
-- ============================================================================

