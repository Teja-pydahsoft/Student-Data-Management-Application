/**
 * Ensures subjects and branch_semester_subjects tables exist (no FKs).
 * Run: node scripts/ensure_faculty_tables.js
 * Use when migrations were marked executed but tables are missing.
 */

const { masterPool } = require('../config/database');

async function ensureSubjectsTable() {
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INT PRIMARY KEY AUTO_INCREMENT,
      college_id INT NOT NULL,
      course_id INT NOT NULL,
      branch_id INT NULL,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_college_course (college_id, course_id),
      INDEX idx_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ subjects table OK');
}

async function ensureBranchSemesterSubjectsTable() {
  await masterPool.query(`
    CREATE TABLE IF NOT EXISTS branch_semester_subjects (
      id INT PRIMARY KEY AUTO_INCREMENT,
      branch_id INT NOT NULL,
      year_of_study TINYINT NOT NULL,
      semester_number TINYINT NOT NULL,
      subject_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_branch_year_sem_subject (branch_id, year_of_study, semester_number, subject_id),
      INDEX idx_branch (branch_id),
      INDEX idx_subject (subject_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('✅ branch_semester_subjects table OK');
}

async function main() {
  try {
    console.log('Ensuring faculty-related tables exist...');
    await ensureSubjectsTable();
    await ensureBranchSemesterSubjectsTable();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
