-- Student Database Management System Schema

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
  roll_number VARCHAR(100),
  student_address TEXT,
  city_village VARCHAR(100),
  mandal_name VARCHAR(100),
  district VARCHAR(100),
  previous_college VARCHAR(255),
  certificates_status VARCHAR(100),
  student_photo VARCHAR(255),
  remarks TEXT,
  custom_fields JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_roll_number (roll_number),
  INDEX idx_pin_no (pin_no),
  INDEX idx_batch (batch),
  INDEX idx_branch (branch)
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
