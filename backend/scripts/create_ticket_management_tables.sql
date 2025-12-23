-- Ticket Management System Tables
-- Run this script to create all necessary tables for ticket/complaint management
-- Note: The database is selected via the connection, so no USE statement is needed

-- Complaint Categories Table (for task management)
CREATE TABLE IF NOT EXISTS complaint_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id INT NULL COMMENT 'NULL for main categories, ID of parent for sub-levels',
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent_id (parent_id),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (parent_id) REFERENCES complaint_categories(id) ON DELETE CASCADE
);

-- Tickets/Complaints Table
CREATE TABLE IF NOT EXISTS tickets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_number VARCHAR(50) UNIQUE NOT NULL COMMENT 'Auto-generated ticket number',
  student_id INT NOT NULL,
  admission_number VARCHAR(100) NOT NULL,
  category_id INT NOT NULL COMMENT 'Main complaint category',
  sub_category_id INT NULL COMMENT 'Sub-level category (if exists)',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT NULL COMMENT 'URL to uploaded photo if available',
  status ENUM('pending', 'approaching', 'resolving', 'completed', 'closed') DEFAULT 'pending',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  INDEX idx_ticket_number (ticket_number),
  INDEX idx_student_id (student_id),
  INDEX idx_admission_number (admission_number),
  INDEX idx_category_id (category_id),
  INDEX idx_sub_category_id (sub_category_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES complaint_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (sub_category_id) REFERENCES complaint_categories(id) ON DELETE SET NULL
);

-- Ticket Assignments Table (assigning tickets to RBAC users)
CREATE TABLE IF NOT EXISTS ticket_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  assigned_to INT NOT NULL COMMENT 'RBAC user ID',
  assigned_by INT NOT NULL COMMENT 'User who assigned (super admin or RBAC user)',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL COMMENT 'Assignment notes',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'False if assignment was revoked',
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_assigned_by (assigned_by),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES rbac_users(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES rbac_users(id) ON DELETE RESTRICT
);

-- Ticket Status History Table (track status changes)
CREATE TABLE IF NOT EXISTS ticket_status_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INT NOT NULL COMMENT 'User who changed the status',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES rbac_users(id) ON DELETE RESTRICT
);

-- Ticket Feedback Table (for completed tickets)
CREATE TABLE IF NOT EXISTS ticket_feedback (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL UNIQUE,
  student_id INT NOT NULL,
  rating INT NOT NULL COMMENT 'Rating from 1 to 5',
  feedback_text TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_student_id (student_id),
  INDEX idx_rating (rating),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CHECK (rating >= 1 AND rating <= 5)
);

-- Ticket Comments/Notes Table (for internal communication)
CREATE TABLE IF NOT EXISTS ticket_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL COMMENT 'RBAC user ID or student ID',
  user_type ENUM('admin', 'student') NOT NULL,
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE COMMENT 'True for internal notes, False for visible to student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

