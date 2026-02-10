-- Feedback Responses Table
CREATE TABLE IF NOT EXISTS feedback_responses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  form_id VARCHAR(255) NOT NULL, -- UUID from forms table
  student_id INT NOT NULL,
  faculty_id INT NOT NULL, -- Linked to rbac_users
  subject_id INT NOT NULL,
  responses JSON NOT NULL,
  academic_year VARCHAR(20) NOT NULL,
  semester INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (faculty_id) REFERENCES rbac_users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  -- We don't enforce foreign key on form_id strictly if it's a UUID string not matching INT id, 
  -- but generally forms.form_id is the key. 
  -- Existing forms table uses form_id VARCHAR.
  
  UNIQUE KEY uniq_student_feedback (student_id, faculty_id, subject_id, form_id, academic_year, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
