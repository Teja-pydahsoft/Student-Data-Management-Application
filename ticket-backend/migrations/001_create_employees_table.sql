-- Migration: Create employees table for Ticket App
-- This table stores ticket-specific employee data (Managers and Workers)
-- It references the rbac_users table for authentication and basic user info

CREATE TABLE IF NOT EXISTS ticket_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rbac_user_id INT NOT NULL,
    role ENUM('staff', 'worker') NOT NULL COMMENT 'staff = Manager, worker = Worker',
    is_active TINYINT(1) DEFAULT 1,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Foreign key to rbac_users table
    CONSTRAINT fk_employee_rbac_user 
        FOREIGN KEY (rbac_user_id) 
        REFERENCES rbac_users(id) 
        ON DELETE CASCADE,
    
    -- Ensure one user can only have one active employee record
    UNIQUE KEY unique_active_employee (rbac_user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for faster lookups
CREATE INDEX idx_employee_role ON ticket_employees(role);
CREATE INDEX idx_employee_active ON ticket_employees(is_active);
