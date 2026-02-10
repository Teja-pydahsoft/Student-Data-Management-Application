-- Migration: Create timetable_entries table
CREATE TABLE IF NOT EXISTS timetable_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  year_of_study TINYINT NOT NULL,
  semester_number TINYINT NOT NULL,
  day_of_week ENUM('MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT', 'SUN') NOT NULL,
  period_slot_id INT NOT NULL,
  subject_id INT NULL,
  type ENUM('subject', 'lab', 'break', 'other') NOT NULL DEFAULT 'subject',
  custom_label VARCHAR(255) NULL,
  span TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branch_year_sem (branch_id, year_of_study, semester_number),
  FOREIGN KEY (branch_id) REFERENCES course_branches(id) ON DELETE CASCADE,
  FOREIGN KEY (period_slot_id) REFERENCES period_slots(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
