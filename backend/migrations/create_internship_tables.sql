-- Create Internship Locations Table
CREATE TABLE IF NOT EXISTS internship_locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius INT DEFAULT 200,
  allowed_start_time VARCHAR(10) NOT NULL,
  allowed_end_time VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Internship Attendance Table
CREATE TABLE IF NOT EXISTS internship_attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  student_id INT NOT NULL,
  internship_id INT NOT NULL,
  check_in_time DATETIME,
  check_out_time DATETIME,
  check_in_location JSON, 
  check_out_location JSON,
  status ENUM('Present', 'Rejected', 'CheckedIn', 'CheckedOut') DEFAULT 'CheckedIn',
  rejection_reason TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  suspicious_reason TEXT,
  attendance_date DATE,
  selfie_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (internship_id) REFERENCES internship_locations(id) ON DELETE CASCADE,
  -- Assuming students table exists and has id as PK
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_student_date (student_id, attendance_date)
);
