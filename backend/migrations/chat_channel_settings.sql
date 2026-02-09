-- Club/chat channel settings: who can send, etc.

CREATE TABLE IF NOT EXISTS chat_channel_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL UNIQUE,
  students_can_send BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_channel (channel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
