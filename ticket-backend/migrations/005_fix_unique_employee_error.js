const { masterPool } = require('../config/database');

async function up() {
    try {
        console.log('Running migration: Cleanup duplicate active employees keys...');

        // 1. Drop the problematic unique index
        try {
            await masterPool.query(`
                ALTER TABLE ticket_employees
                DROP INDEX unique_active_employee
            `);
            console.log('✓ Dropped index: unique_active_employee');
        } catch (error) {
            console.log('Index unique_active_employee might not exist or already dropped:', error.message);
        }

        // 2. Add a standard non-unique index on rbac_user_id just for lookups (if needed)
        // or a new unique index if we can figure out how to exclude inactive logic efficiently.
        // For now, simpler is better: Application logic handles uniqueness.
        // We will add a simple index for performance.
        try {
            await masterPool.query(`
                CREATE INDEX idx_employee_rbac_user ON ticket_employees(rbac_user_id)
            `);
            console.log('✓ Created index: idx_employee_rbac_user');
        } catch (error) {
            if (error.code !== 'ER_DUP_KEYNAME') console.log('Index idx_employee_rbac_user already exists');
        }

        console.log('✅ Migration 005 completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Migration 005 failed:', error.message);
        throw error;
    }
}

async function down() {
    // Re-add the unique index (Might fail if duplicates exist now)
    try {
        await masterPool.query(`
            CREATE UNIQUE INDEX unique_active_employee ON ticket_employees(rbac_user_id, is_active)
        `);
    } catch (e) {
        console.log('Could not re-add unique index:', e.message);
    }
}

module.exports = { up, down };

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
