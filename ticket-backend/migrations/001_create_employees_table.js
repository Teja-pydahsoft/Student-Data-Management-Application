const { masterPool } = require('../config/database');

/**
 * Migration: Create ticket_employees table
 * This table stores ticket-specific employee assignments
 */
async function up() {
    try {
        console.log('Running migration: Create ticket_employees table...');

        // Create ticket_employees table
        await masterPool.query(`
            CREATE TABLE IF NOT EXISTS ticket_employees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                rbac_user_id INT NOT NULL,
                role ENUM('staff', 'worker') NOT NULL COMMENT 'staff = Manager, worker = Worker',
                is_active TINYINT(1) DEFAULT 1,
                assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                CONSTRAINT fk_employee_rbac_user 
                    FOREIGN KEY (rbac_user_id) 
                    REFERENCES rbac_users(id) 
                    ON DELETE CASCADE,
                
                UNIQUE KEY unique_active_employee (rbac_user_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✓ Created ticket_employees table');

        // Create indexes (with existence check)
        try {
            await masterPool.query(`
                CREATE INDEX idx_employee_role ON ticket_employees(role)
            `);
            console.log('✓ Created index: idx_employee_role');
        } catch (error) {
            if (error.code !== 'ER_DUP_KEYNAME') throw error;
            console.log('✓ Index idx_employee_role already exists');
        }

        try {
            await masterPool.query(`
                CREATE INDEX idx_employee_active ON ticket_employees(is_active)
            `);
            console.log('✓ Created index: idx_employee_active');
        } catch (error) {
            if (error.code !== 'ER_DUP_KEYNAME') throw error;
            console.log('✓ Index idx_employee_active already exists');
        }

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
        console.log('Rolling back migration: Drop ticket_employees table...');

        await masterPool.query(`DROP TABLE IF EXISTS ticket_employees`);

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
