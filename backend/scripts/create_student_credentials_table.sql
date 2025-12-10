-- Create student credentials table for username/password login
USE student_database;

CREATE TABLE IF NOT EXISTS student_credentials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  admission_number VARCHAR(100),
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_admission_number (admission_number),
  INDEX idx_username (username),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

