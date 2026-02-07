-- Pydah v2.0 academic tables (no FKs for reliable creation)
CREATE TABLE IF NOT EXISTS period_slots (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_college (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  college_id INT NOT NULL,
  course_id INT NOT NULL,
  branch_id INT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_college_course (college_id, course_id),
  INDEX idx_branch (branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faculty_subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rbac_user_id INT NOT NULL,
  subject_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_faculty_subject (rbac_user_id, subject_id),
  INDEX idx_subject (subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_content (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type ENUM('note','assignment','test') NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NULL,
  file_url VARCHAR(1000) NULL,
  subject_id INT NULL,
  college_id INT NOT NULL,
  course_id INT NULL,
  branch_id INT NULL,
  posted_by INT NULL,
  due_date DATE NULL,
  max_marks DECIMAL(6,2) NULL,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type_college (type, college_id),
  INDEX idx_subject (subject_id),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content_id INT NOT NULL,
  student_id INT NOT NULL,
  submission_type ENUM('assignment','test') NOT NULL,
  file_url VARCHAR(1000) NULL,
  marks DECIMAL(6,2) NULL,
  max_marks DECIMAL(6,2) NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  evaluated_at TIMESTAMP NULL,
  evaluated_by INT NULL,
  remarks TEXT NULL,
  UNIQUE KEY uniq_content_student (content_id, student_id),
  INDEX idx_student (student_id),
  INDEX idx_content (content_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_marks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  academic_year VARCHAR(20) NULL,
  semester TINYINT NULL,
  marks_type VARCHAR(50) NOT NULL,
  marks DECIMAL(6,2) NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student_subject (student_id, subject_id),
  INDEX idx_semester (academic_year, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hourly_attendance_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  period_slot_id INT NOT NULL,
  status ENUM('present','absent') NOT NULL,
  marked_by INT NULL,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_student_date_period (student_id, attendance_date, period_slot_id),
  INDEX idx_date_period (attendance_date, period_slot_id),
  INDEX idx_marked_by (marked_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
