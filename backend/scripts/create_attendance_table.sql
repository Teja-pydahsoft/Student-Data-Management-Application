USE student_database;

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  admission_number VARCHAR(100),
  attendance_date DATE NOT NULL,
  status ENUM('present','absent') NOT NULL,
  marked_by INT NULL,
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_date (student_id, attendance_date),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_status (status),
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES students(id)
    ON DELETE CASCADE
);

