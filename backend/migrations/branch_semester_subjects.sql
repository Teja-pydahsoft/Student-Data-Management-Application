-- Branch semester subjects: which subjects are taught in which year/sem for a branch (HOD config)
CREATE TABLE IF NOT EXISTS branch_semester_subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  year_of_study TINYINT NOT NULL,
  semester_number TINYINT NOT NULL,
  subject_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_branch_year_sem_subject (branch_id, year_of_study, semester_number, subject_id),
  INDEX idx_branch (branch_id),
  INDEX idx_subject (subject_id),
  FOREIGN KEY (branch_id) REFERENCES course_branches(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
