-- Migration: Add 'holiday' to attendance_records.status ENUM
-- Purpose: Allow marking attendance as "no class work" (holiday) for students.
-- Without this, INSERT/UPDATE with status='holiday' fails with MySQL error.
-- Safe to re-run: MODIFY with same/superset enum values succeeds idempotently.

ALTER TABLE attendance_records
MODIFY COLUMN status ENUM('present','absent','holiday') NOT NULL;
