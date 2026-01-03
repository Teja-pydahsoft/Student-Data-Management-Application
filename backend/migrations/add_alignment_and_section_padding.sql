-- Migration: Add alignment and section padding columns to certificate_templates table
-- Date: December 2024
-- Description: Adds text alignment options for each section and section-specific padding controls

USE student_database;

-- Add alignment columns for each content section
ALTER TABLE certificate_templates
ADD COLUMN top_alignment ENUM('left', 'center', 'right') DEFAULT 'center' AFTER top_content,
ADD COLUMN middle_alignment ENUM('left', 'center', 'right') DEFAULT 'center' AFTER middle_content,
ADD COLUMN bottom_alignment ENUM('left', 'center', 'right') DEFAULT 'center' AFTER bottom_content;

-- Add section-specific padding columns
ALTER TABLE certificate_templates
ADD COLUMN top_section_padding INT DEFAULT 10 COMMENT 'Padding for top section in pixels',
ADD COLUMN middle_section_padding INT DEFAULT 20 COMMENT 'Padding for middle section in pixels',
ADD COLUMN bottom_section_padding INT DEFAULT 10 COMMENT 'Padding for bottom section in pixels';
