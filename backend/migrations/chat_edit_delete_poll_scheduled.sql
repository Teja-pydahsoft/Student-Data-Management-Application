-- Chat: edit within 5 min, soft-delete with "deleted by", polls (yes/no), scheduled messages

-- 1) chat_messages: edit + soft-delete + poll support (run once)
ALTER TABLE chat_messages ADD COLUMN edited_at TIMESTAMP NULL AFTER created_at;
ALTER TABLE chat_messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER edited_at;
ALTER TABLE chat_messages ADD COLUMN deleted_at TIMESTAMP NULL AFTER is_deleted;
ALTER TABLE chat_messages ADD COLUMN deleted_by_rbac_id INT NULL AFTER deleted_at;
ALTER TABLE chat_messages ADD COLUMN message_type ENUM('text','poll') DEFAULT 'text' AFTER deleted_by_rbac_id;
ALTER TABLE chat_messages ADD COLUMN poll_yes_count INT DEFAULT 0 AFTER message_type;
ALTER TABLE chat_messages ADD COLUMN poll_no_count INT DEFAULT 0 AFTER poll_yes_count;

-- 2) Poll votes: one vote per user per poll message
CREATE TABLE IF NOT EXISTS chat_poll_votes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  voter_student_id INT NULL,
  voter_rbac_id INT NULL,
  vote ENUM('yes','no') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message (message_id),
  UNIQUE KEY uniq_poll_student (message_id, voter_student_id),
  UNIQUE KEY uniq_poll_rbac (message_id, voter_rbac_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Scheduled messages: send at scheduled_at
CREATE TABLE IF NOT EXISTS chat_scheduled_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL,
  sender_type ENUM('student','faculty','admin') NOT NULL,
  student_id INT NULL,
  rbac_user_id INT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  status ENUM('pending','sent','cancelled') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  INDEX idx_channel_scheduled (channel_id, status),
  INDEX idx_scheduled_at (scheduled_at, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
