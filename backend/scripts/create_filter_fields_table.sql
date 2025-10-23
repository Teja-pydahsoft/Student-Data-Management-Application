-- Create filter_fields table for filter field management
USE student_database;

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

-- Insert some default filter field configurations based on common student fields
INSERT IGNORE INTO filter_fields (field_name, field_type, enabled, required, options) VALUES
('batch', 'text', true, false, '[]'),
('branch', 'text', true, false, '[]'),
('stud_type', 'text', true, false, '[]'),
('caste', 'text', true, false, '[]'),
('gender', 'text', true, false, '[]'),
('district', 'text', true, false, '[]'),
('mandal_name', 'text', true, false, '[]'),
('city_village', 'text', true, false, '[]'),
('student_status', 'text', true, false, '[]'),
('scholar_status', 'text', true, false, '[]'),
('admission_date', 'date', true, false, '[]'),
('dob', 'date', true, false, '[]');

SELECT 'Filter fields table created successfully!' as status;