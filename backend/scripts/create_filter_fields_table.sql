-- Create filter_fields table for filter field management
USE student_database;

CREATE TABLE IF NOT EXISTS filter_fields (
  id INT PRIMARY KEY AUTO_INCREMENT,
  field_name VARCHAR(255) UNIQUE NOT NULL,
  field_type VARCHAR(50) DEFAULT 'text',
  enabled BOOLEAN DEFAULT TRUE,
  required BOOLEAN DEFAULT FALSE,
  options JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_field_name (field_name),
  INDEX idx_enabled (enabled)
);

-- Insert some default filter field configurations based on common student fields
INSERT IGNORE INTO filter_fields (field_name, field_type, enabled, required, options) VALUES
('batch', 'text', true, false, JSON_ARRAY()),
('branch', 'text', true, false, JSON_ARRAY()),
('stud_type', 'text', true, false, JSON_ARRAY()),
('caste', 'text', true, false, JSON_ARRAY()),
('gender', 'text', true, false, JSON_ARRAY()),
('district', 'text', true, false, JSON_ARRAY()),
('mandal_name', 'text', true, false, JSON_ARRAY()),
('city_village', 'text', true, false, JSON_ARRAY()),
('student_status', 'text', true, false, JSON_ARRAY()),
('scholar_status', 'text', true, false, JSON_ARRAY()),
('admission_date', 'date', true, false, JSON_ARRAY()),
('dob', 'date', true, false, JSON_ARRAY());

SELECT 'Filter fields table created successfully!' as status;