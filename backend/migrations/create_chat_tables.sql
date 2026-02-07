-- Chat tables for club/subject/event communication (Pydah v2.0)
-- No foreign keys to avoid dependency on table order/availability

CREATE TABLE IF NOT EXISTS chat_channels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_type ENUM('subject','club','event') NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject_id INT NULL,
  club_id INT NULL,
  event_id INT NULL,
  college_id INT NULL,
  created_by INT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (channel_type),
  INDEX idx_club (club_id),
  INDEX idx_college (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_channel_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL,
  member_type ENUM('student','faculty','admin') NOT NULL,
  student_id INT NULL,
  rbac_user_id INT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel (channel_id),
  INDEX idx_student (student_id),
  UNIQUE KEY uniq_channel_student (channel_id, student_id),
  UNIQUE KEY uniq_channel_rbac (channel_id, rbac_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL,
  sender_type ENUM('student','faculty','admin') NOT NULL,
  student_id INT NULL,
  rbac_user_id INT NULL,
  message TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  moderated_at TIMESTAMP NULL,
  moderated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel (channel_id),
  INDEX idx_created (created_at),
  INDEX idx_hidden (is_hidden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
