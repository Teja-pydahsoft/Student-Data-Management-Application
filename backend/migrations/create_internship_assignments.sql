CREATE TABLE IF NOT EXISTS internship_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    internship_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    allowed_days JSON, 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (internship_id) REFERENCES internship_locations(id) ON DELETE CASCADE,
    INDEX idx_student_assignment (student_id),
    INDEX idx_internship_assignment (internship_id)
);
