-- Add recurrence_config column to forms table
ALTER TABLE forms
ADD COLUMN recurrence_config JSON DEFAULT NULL COMMENT 'Config for recurring feedback: {type: "days", value: 30, next_run: "2024-01-01"}';
