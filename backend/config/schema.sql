-- Pydah Student Database Management System Schema

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS student_database;
USE student_database;

-- Admin users table
CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Students table with fixed fields
CREATE TABLE IF NOT EXISTS students (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admission_number VARCHAR(100) NULL,
  admission_no VARCHAR(100) NULL,
  pin_no VARCHAR(50),
  batch VARCHAR(50),
  branch VARCHAR(100),
  stud_type VARCHAR(50),
  student_name VARCHAR(255) NOT NULL,
  student_status VARCHAR(50),
  scholar_status VARCHAR(50),
  student_mobile VARCHAR(20),
  parent_mobile1 VARCHAR(20),
  parent_mobile2 VARCHAR(20),
  caste VARCHAR(50),
  gender ENUM('M', 'F', 'Other'),
  father_name VARCHAR(255),
  dob VARCHAR(50),
  adhar_no VARCHAR(20),
  admission_date VARCHAR(50),
  student_address TEXT,
  city_village VARCHAR(100),
  mandal_name VARCHAR(100),
  district VARCHAR(100),
  previous_college VARCHAR(255),
  certificates_status VARCHAR(100),
  student_photo LONGTEXT,
  remarks TEXT,
  custom_fields JSON,
  student_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_admission_number (admission_number),
  INDEX idx_admission_no (admission_no),
  INDEX idx_pin_no (pin_no),
  INDEX idx_batch (batch),
  INDEX idx_branch (branch)
);

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  form_id VARCHAR(100) UNIQUE NOT NULL,
  form_name VARCHAR(255) NOT NULL,
  form_description TEXT,
  form_fields JSON NOT NULL,
  qr_code_data LONGTEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_form_id (form_id),
  INDEX idx_is_active (is_active)
);

-- Form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  submission_id VARCHAR(100) UNIQUE NOT NULL,
  form_id VARCHAR(100) NOT NULL,
  admission_number VARCHAR(100),
  submission_data TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  submitted_by ENUM('student', 'admin') DEFAULT 'student',
  submitted_by_admin INT NULL,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE CASCADE,
  FOREIGN KEY (submitted_by_admin) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_submission_id (submission_id),
  INDEX idx_form_id (form_id),
  INDEX idx_status (status),
  INDEX idx_admission_number (admission_number)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  admin_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_action (action_type),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
);

-- Staging database for unapproved submissions
CREATE DATABASE IF NOT EXISTS student_staging;
USE student_staging;

-- Staging tables (admin/auth, forms, submissions, audit logs live here)
CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  form_id VARCHAR(100) UNIQUE NOT NULL,
  form_name VARCHAR(255) NOT NULL,
  form_description TEXT,
  form_fields JSON NOT NULL,
  qr_code_data LONGTEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_form_id (form_id),
  INDEX idx_is_active (is_active)
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  submission_id VARCHAR(100) UNIQUE NOT NULL,
  form_id VARCHAR(100) NOT NULL,
  admission_number VARCHAR(100),
  submission_data TEXT NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  submitted_by ENUM('student','admin') DEFAULT 'student',
  submitted_by_admin INT NULL,
  reviewed_by INT NULL,
  reviewed_at TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_submission_id (submission_id),
  INDEX idx_form_id (form_id),
  INDEX idx_status (status),
  INDEX idx_admission_number (admission_number)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  admin_id INT,
  details JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  INDEX idx_action (action_type),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created (created_at)
);

-- Filter fields configuration table
CREATE TABLE IF NOT EXISTS filter_fields (
  id INT PRIMARY KEY AUTO_INCREMENT,
  field_name VARCHAR(255) UNIQUE NOT NULL,
  field_type VARCHAR(50) DEFAULT 'text',
  enabled BOOLEAN DEFAULT TRUE,
  required BOOLEAN DEFAULT FALSE,
  options JSON DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_field_name (field_name),
  INDEX idx_enabled (enabled)
);

-- Switch back to master DB for subsequent DDL in this file if any
USE student_database;
