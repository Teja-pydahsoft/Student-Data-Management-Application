-- Migration: Add typography and image size columns to certificate_templates table
-- Date: December 2024
-- Description: Adds font size, line spacing, and header/footer height controls

USE student_database;

-- Add typography columns
ALTER TABLE certificate_templates
ADD COLUMN font_size INT DEFAULT 12 COMMENT 'Font size in pixels',
ADD COLUMN line_spacing DECIMAL(3,1) DEFAULT 1.5 COMMENT 'Line height multiplier';

-- Add header and footer size columns
ALTER TABLE certificate_templates
ADD COLUMN header_height INT DEFAULT 80 COMMENT 'Header image height in pixels',
ADD COLUMN footer_height INT DEFAULT 60 COMMENT 'Footer image height in pixels';
