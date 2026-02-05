-- ============================================================================
-- Migration: RBAC Role Configuration
-- ============================================================================
-- Stores default module access (permissions) per role. When a user is created
-- with a role, their permissions are copied from this config. When config
-- is updated, existing users with that role can be updated (propagate).
-- ============================================================================

CREATE TABLE IF NOT EXISTS rbac_role_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_key VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role_key (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'rbac_role_config table created' AS status;
