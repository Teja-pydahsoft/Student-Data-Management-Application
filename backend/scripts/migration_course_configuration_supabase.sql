-- Migration: Course and Branch configuration support for Supabase (Postgres)
-- Run this script against the Supabase staging database (Postgres dialect)

-- Ensure we are working in the public schema
SET search_path TO public;

-- Add course column to staging students table if it does not exist
ALTER TABLE IF EXISTS students
  ADD COLUMN IF NOT EXISTS course VARCHAR(100);

-- Add index for course column in staging
CREATE INDEX IF NOT EXISTS idx_students_course ON students (course);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  total_years SMALLINT NOT NULL DEFAULT 4,
  semesters_per_year SMALLINT NOT NULL DEFAULT 2,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints for courses
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_name_unique ON courses (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_code_unique ON courses (LOWER(code)) WHERE code IS NOT NULL;

-- Create course_branches table
CREATE TABLE IF NOT EXISTS course_branches (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  total_years SMALLINT,
  semesters_per_year SMALLINT,
  metadata JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraints for course_branches
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_branches_name_unique
  ON course_branches (course_id, LOWER(name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_branches_code_unique
  ON course_branches (course_id, LOWER(code))
  WHERE code IS NOT NULL;

-- Trigger to auto-update updated_at columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
    RETURNS trigger AS $BODY$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $BODY$ LANGUAGE plpgsql;
  END IF;
END;
$$;

-- Attach trigger to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'courses_set_updated_at'
  ) THEN
    CREATE TRIGGER courses_set_updated_at
      BEFORE UPDATE ON courses
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END;
$$;

-- Attach trigger to course_branches table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'course_branches_set_updated_at'
  ) THEN
    CREATE TRIGGER course_branches_set_updated_at
      BEFORE UPDATE ON course_branches
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();
  END IF;
END;
$$;


