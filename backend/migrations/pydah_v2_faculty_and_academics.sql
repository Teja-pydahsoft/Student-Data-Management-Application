-- ============================================================================
-- Pydah Student Portal v2.0 – Faculty & Academics
-- ============================================================================
-- Tables: period_slots, hourly_attendance_records, subjects, faculty_subjects,
--         academic_content, content_submissions, internal_marks,
--         chat_channels, chat_channel_members, chat_messages
-- Prerequisites: colleges, courses, course_branches, students, rbac_users,
--                clubs, events (existing)
-- ============================================================================

-- Period slots (e.g. P1 09:00-10:00) per college
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
  INDEX idx_college (college_id),
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hourly/period-wise attendance (faculty posts per period per date)
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
  INDEX idx_marked_by (marked_by),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (period_slot_id) REFERENCES period_slots(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Subjects (per course/branch/college for content and subject chats)
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
  INDEX idx_branch (branch_id),
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES course_branches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Faculty–subject assignment (faculty = rbac_users.id)
CREATE TABLE IF NOT EXISTS faculty_subjects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rbac_user_id INT NOT NULL,
  subject_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_faculty_subject (rbac_user_id, subject_id),
  INDEX idx_subject (subject_id),
  FOREIGN KEY (rbac_user_id) REFERENCES rbac_users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Academic content (notes, assignments, tests)
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
  INDEX idx_due_date (due_date),
  INDEX idx_posted_by (posted_by),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES course_branches(id) ON DELETE SET NULL,
  FOREIGN KEY (posted_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Student submissions for assignments/tests (marks stored here or in internal_marks)
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
  INDEX idx_content (content_id),
  FOREIGN KEY (content_id) REFERENCES academic_content(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluated_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Internal marks (internal1, internal2, assignment etc. per student/subject/semester)
CREATE TABLE IF NOT EXISTS internal_marks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  academic_year VARCHAR(20) NULL,
  semester TINYINT NULL,
  marks_type VARCHAR(50) NOT NULL COMMENT 'e.g. internal1, internal2, assignment',
  marks DECIMAL(6,2) NOT NULL,
  max_marks DECIMAL(6,2) NOT NULL DEFAULT 100,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_student_subject (student_id, subject_id),
  INDEX idx_semester (academic_year, semester),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat channels (subject, club, or event)
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
  INDEX idx_subject (subject_id),
  INDEX idx_club (club_id),
  INDEX idx_event (event_id),
  INDEX idx_college (college_id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
  FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Event id: reference only if events table has id (application-level)
-- ALTER TABLE chat_channels ADD CONSTRAINT fk_chat_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
-- Skipping FK to events to avoid dependency on events table structure (add in app if needed).

-- Chat channel membership
CREATE TABLE IF NOT EXISTS chat_channel_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  channel_id INT NOT NULL,
  member_type ENUM('student','faculty','admin') NOT NULL,
  student_id INT NULL,
  rbac_user_id INT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_channel (channel_id),
  INDEX idx_student (student_id),
  INDEX idx_rbac (rbac_user_id),
  UNIQUE KEY uniq_channel_student (channel_id, student_id),
  UNIQUE KEY uniq_channel_rbac (channel_id, rbac_user_id),
  FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (rbac_user_id) REFERENCES rbac_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per member: either student_id or rbac_user_id set (enforced in app)

-- Chat messages (with moderation support)
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
  INDEX idx_hidden (is_hidden),
  FOREIGN KEY (channel_id) REFERENCES chat_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  FOREIGN KEY (rbac_user_id) REFERENCES rbac_users(id) ON DELETE SET NULL,
  FOREIGN KEY (moderated_by) REFERENCES rbac_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Pydah v2.0 faculty and academics tables created successfully' AS status;