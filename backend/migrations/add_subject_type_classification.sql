-- Add subject type classification (Theory/Lab) with units and experiment counts

ALTER TABLE subjects 
ADD COLUMN subject_type ENUM('theory', 'lab') DEFAULT 'theory' AFTER code,
ADD COLUMN units INT NULL COMMENT 'Number of units for theory subjects' AFTER subject_type,
ADD COLUMN experiments_count INT NULL COMMENT 'Number of experiments for lab subjects' AFTER units,
ADD COLUMN credits DECIMAL(3,1) NULL COMMENT 'Credit hours for the subject' AFTER experiments_count;

-- Update existing subjects to have default values
UPDATE subjects SET subject_type = 'theory' WHERE subject_type IS NULL;
