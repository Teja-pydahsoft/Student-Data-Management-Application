# Database Migrations

This directory contains database migration scripts for the Ticket Backend.

## Overview

Migrations are used to manage database schema changes in a version-controlled manner. Each migration file represents a specific change to the database structure.

## Migration Files

- **`001_create_employees_table.js`** - Creates the `ticket_employees` table for managing ticket-specific employee assignments

## How It Works

### Automatic Migrations
Migrations run automatically when the server starts. The system:
1. Checks for pending migrations
2. Executes them in order
3. Tracks which migrations have been run in the `migrations` table

### Manual Migration Commands

You can also run migrations manually:

```bash
# Run all pending migrations
npm run migrate

# Rollback the last migration
npm run migrate:rollback
```

## Migration Structure

Each migration file must export two functions:

```javascript
// Apply the migration
async function up() {
    // Create tables, add columns, etc.
}

// Revert the migration
async function down() {
    // Drop tables, remove columns, etc.
}

module.exports = { up, down };
```

## Creating New Migrations

1. Create a new file in this directory with a numbered prefix:
   ```
   002_your_migration_name.js
   ```

2. Implement the `up()` and `down()` functions:
   ```javascript
   const { masterPool } = require('../config/database');

   async function up() {
       await masterPool.query(`
           -- Your SQL here
       `);
   }

   async function down() {
       await masterPool.query(`
           -- Rollback SQL here
       `);
   }

   module.exports = { up, down };
   ```

3. The migration will run automatically on next server start, or run manually:
   ```bash
   npm run migrate
   ```

## Migration Tracking

The system creates a `migrations` table to track which migrations have been executed:

```sql
CREATE TABLE migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Best Practices

1. **Never modify executed migrations** - Create a new migration instead
2. **Always provide a `down()` function** - For rollback capability
3. **Test migrations** - Run them in development before production
4. **Use transactions** - When possible, wrap migrations in transactions
5. **Keep migrations small** - One logical change per migration

## Troubleshooting

### Migration Failed
If a migration fails:
1. Check the error message in the console
2. Fix the issue in the migration file
3. Rollback if needed: `npm run migrate:rollback`
4. Run the migration again: `npm run migrate`

### Reset All Migrations
⚠️ **Warning: This will delete all data**

```sql
DROP TABLE IF EXISTS ticket_employees;
DROP TABLE IF EXISTS migrations;
```

Then restart the server to run all migrations fresh.

## Current Schema

### ticket_employees
Stores ticket-specific employee assignments linking RBAC users to ticket roles.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| rbac_user_id | INT | Foreign key to rbac_users table |
| role | ENUM('staff', 'worker') | Employee role (Manager/Worker) |
| is_active | TINYINT(1) | Soft delete flag |
| assigned_date | DATETIME | When employee was assigned |
| created_at | DATETIME | Record creation timestamp |
| updated_at | DATETIME | Record update timestamp |

**Indexes:**
- `idx_employee_role` - On `role` column
- `idx_employee_active` - On `is_active` column

**Constraints:**
- Foreign key to `rbac_users(id)` with CASCADE delete
- Unique constraint on `(rbac_user_id, is_active)` to prevent duplicate active assignments
