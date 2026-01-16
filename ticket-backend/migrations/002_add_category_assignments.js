const { masterPool } = require('../config/database');

/**
 * Migration: Add category assignments to ticket_employees
 * Managers can be assigned to specific main categories and sub-categories
 */
async function up() {
    try {
        console.log('Running migration: Add category assignments to ticket_employees...');

        // Add columns for category assignments
        await masterPool.query(`
            ALTER TABLE ticket_employees
            ADD COLUMN assigned_categories JSON DEFAULT NULL COMMENT 'Array of main category IDs assigned to this manager',
            ADD COLUMN assigned_subcategories JSON DEFAULT NULL COMMENT 'Array of sub-category IDs assigned to this manager'
        `);

        console.log('✓ Added category assignment columns to ticket_employees table');

        console.log('✅ Migration completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    }
}

/**
 * Rollback migration
 */
async function down() {
    try {
        console.log('Rolling back migration: Remove category assignments from ticket_employees...');

        await masterPool.query(`
            ALTER TABLE ticket_employees
            DROP COLUMN assigned_categories,
            DROP COLUMN assigned_subcategories
        `);

        console.log('✅ Rollback completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Rollback failed:', error.message);
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
