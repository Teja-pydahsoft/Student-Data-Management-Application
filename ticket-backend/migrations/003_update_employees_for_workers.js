const { masterPool } = require('../config/database');

/**
 * Migration: Update ticket_employees for Standalone Workers
 * 1. Make rbac_user_id nullable (so workers don't need an RBAC account)
 * 2. Add identity columns (name, username, email, password_hash, phone) for workers
 */
async function up() {
    try {
        console.log('Running migration: Update ticket_employees for standalone workers...');

        // 1. Make rbac_user_id Nullable
        await masterPool.query(`
            ALTER TABLE ticket_employees
            MODIFY COLUMN rbac_user_id INT NULL
        `);
        console.log('✓ Made rbac_user_id nullable');

        // 2. Add Identity Columns
        await masterPool.query(`
            ALTER TABLE ticket_employees
            ADD COLUMN name VARCHAR(100) DEFAULT NULL,
            ADD COLUMN username VARCHAR(50) DEFAULT NULL,
            ADD COLUMN email VARCHAR(100) DEFAULT NULL,
            ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL,
            ADD COLUMN phone VARCHAR(20) DEFAULT NULL
        `);
        console.log('✓ Added identity columns (name, username, email, password_hash, phone)');

        // 3. Add Unique Index on Username (to prevent duplicates between workers)
        try {
            await masterPool.query(`
                CREATE UNIQUE INDEX idx_employee_username ON ticket_employees(username)
            `);
            console.log('✓ Created unique index: idx_employee_username');
        } catch (error) {
            if (error.code !== 'ER_DUP_KEYNAME') throw error;
            console.log('✓ Index idx_employee_username already exists');
        }

        console.log('✅ Migration 003 completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Migration 003 failed:', error.message);
        throw error;
    }
}

/**
 * Rollback migration
 */
async function down() {
    try {
        console.log('Rolling back migration 003...');

        // 1. Drop Identity Columns
        await masterPool.query(`
            ALTER TABLE ticket_employees
            DROP COLUMN name,
            DROP COLUMN username,
            DROP COLUMN email,
            DROP COLUMN password_hash,
            DROP COLUMN phone
        `);

        // 2. Revert rbac_user_id to NOT NULL (Warning: This will fail if there are existing NULL records)
        // We generally avoid strict rollback of this if data exists, but for completeness:
        // await masterPool.query(`ALTER TABLE ticket_employees MODIFY COLUMN rbac_user_id INT NOT NULL`);

        console.log('✅ Rollback 003 completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Rollback 003 failed:', error.message);
        throw error;
    }
}

module.exports = { up, down };

// Run migration if executed directly
if (require.main === module) {
    (async () => {
        try {
            await up();
            process.exit(0);
        } catch (error) {
            console.error('Migration script failed:', error);
            process.exit(1);
        }
    })();
}
