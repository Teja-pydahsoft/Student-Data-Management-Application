-- Branch HOD year assignments: allows multiple HODs per branch, each responsible for specific years
-- e.g. HOD1 for Year 1, HOD2 for Years 2,3,4
CREATE TABLE IF NOT EXISTS branch_hod_year_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  rbac_user_id INT NOT NULL,
  years JSON NOT NULL COMMENT 'Array of year numbers, e.g. [1] or [2,3,4]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_branch_user (branch_id, rbac_user_id),
  INDEX idx_branch (branch_id),
  INDEX idx_user (rbac_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
