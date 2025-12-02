# Database Migration Guide

## Document Requirements Table Migration

This guide explains how to set up the `document_requirements` table in MySQL for the document management feature.

### What Needs to Be Migrated?

1. **New Table: `document_requirements`** - Stores document requirements configuration for different course types (UG/PG) and academic stages (10th, Inter, Diploma, UG) in MySQL (master database).

### Migration Steps

#### Option 1: Using the Migration Script (Recommended)

1. **Make sure your `.env` file is configured** with MySQL credentials:
   ```env
   DB_HOST=your-mysql-host
   DB_USER=your-mysql-user
   DB_PASSWORD=your-mysql-password
   DB_NAME=student_database
   ```

2. **Run the migration script:**
   ```bash
   cd backend
   npm run migrate-document-requirements
   ```

3. The script will:
   - Connect to MySQL
   - Create the `document_requirements` table
   - Create necessary indexes
   - Verify the table was created successfully

#### Option 2: Manual Migration (Direct SQL)

1. **Connect to your MySQL database** (using MySQL Workbench, phpMyAdmin, or command line)

2. **Select your database:**
   ```sql
   USE student_database;
   ```

3. **Copy and paste the SQL** from `backend/scripts/create_document_requirements_table.sql`

4. **Execute the SQL**

### SQL to Execute (MySQL)

```sql
-- Create document_requirements table
CREATE TABLE IF NOT EXISTS document_requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_type VARCHAR(10) NOT NULL,
  academic_stage VARCHAR(50) NOT NULL,
  required_documents JSON NOT NULL DEFAULT ('[]'),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_course_stage (course_type, academic_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_requirements_course_type 
ON document_requirements(course_type);

CREATE INDEX IF NOT EXISTS idx_document_requirements_academic_stage 
ON document_requirements(academic_stage);

CREATE INDEX IF NOT EXISTS idx_document_requirements_enabled 
ON document_requirements(is_enabled);
```

### Verify Migration

After running the migration, verify it worked:

1. **Run the test script:**
   ```bash
   npm run test-supabase
   ```
   It should show "✅ document_requirements table EXISTS!"

2. **Or check directly in MySQL:**
   ```sql
   USE student_database;
   SHOW TABLES LIKE 'document_requirements';
   DESCRIBE document_requirements;
   ```

### Table Structure

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT AUTO_INCREMENT | Primary key |
| `course_type` | VARCHAR(10) | Course type: 'UG' or 'PG' |
| `academic_stage` | VARCHAR(50) | Academic stage: '10th', 'Inter', 'Diploma', or 'UG' |
| `required_documents` | JSON | Array of required document names (e.g., `["10th Certificate", "10th Study Certificate"]`) |
| `is_enabled` | BOOLEAN | Whether this requirement is active |
| `created_at` | TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp (auto-updates) |

### Unique Constraint

The table has a unique constraint on `(course_type, academic_stage)`, meaning you can only have one configuration per combination of course type and academic stage.

### Example Data

After migration, you can add document requirements via the Settings UI, or manually:

```sql
-- Example: UG course, 10th stage requirements
INSERT INTO document_requirements (course_type, academic_stage, required_documents, is_enabled)
VALUES (
  'UG',
  '10th',
  JSON_ARRAY('10th Certificate', '10th Study Certificate', '10th TC (Transfer Certificate)'),
  true
);

-- Example: PG course, UG stage requirements
INSERT INTO document_requirements (course_type, academic_stage, required_documents, is_enabled)
VALUES (
  'PG',
  'UG',
  JSON_ARRAY('UG Certificate', 'UG Study Certificate', 'UG TC (Transfer Certificate)'),
  true
);
```

### Troubleshooting

**Error: "relation document_requirements does not exist"**
- The table hasn't been created yet. Run the migration SQL in Supabase.

**Error: "duplicate key value violates unique constraint"**
- You're trying to insert a duplicate `(course_type, academic_stage)` combination.
- Use `UPSERT` or update the existing record instead.

**Error: "Duplicate entry"**
- You're trying to insert a duplicate `(course_type, academic_stage)` combination
- Use `INSERT ... ON DUPLICATE KEY UPDATE` or update the existing record instead

**Error: "Access denied"**
- Check your MySQL user has CREATE TABLE and INSERT permissions
- Verify your `.env` credentials are correct

### Next Steps

After migration:
1. ✅ The table is created
2. ✅ You can configure document requirements in Settings → Document Requirements
3. ✅ Students can upload documents based on their course type (UG/PG)
4. ✅ Documents will be stored in S3 during submission approval

### No Other Migrations Needed

- **S3 Integration**: Uses existing `student_data` JSON field - no migration needed
- **Form Fields**: Uses existing `forms` table - no migration needed
- **APAAR ID**: Can be added as a regular form field - no migration needed

---

**Migration Status:** ✅ Ready to run
**Backward Compatible:** Yes (legacy endpoints still work)

