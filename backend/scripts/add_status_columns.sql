ALTER TABLE students
ADD COLUMN fee_status ENUM('pending', 'partially_completed', 'completed') DEFAULT 'pending',
ADD COLUMN registration_status ENUM('pending', 'completed') DEFAULT 'pending';