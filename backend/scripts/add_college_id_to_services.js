const { masterPool } = require('../config/database');

async function updateServicesSchema() {
    try {
        console.log('🔄 Adding college_id to services table...');

        // Add college_id column
        try {
            await masterPool.execute('ALTER TABLE services ADD COLUMN college_id INT NULL AFTER price');
            console.log('  ✅ Added college_id column');
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME') {
                console.log('  ℹ️ college_id column already exists');
            } else {
                throw err;
            }
        }

        // Add foreign key constraint
        try {
            await masterPool.execute('ALTER TABLE services ADD CONSTRAINT fk_services_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL');
            console.log('  ✅ Added foreign key constraint');
        } catch (err) {
            console.log('  ℹ️ Constraint might already exist or failed:', err.message);
        }

        console.log('✅ Services schema updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating services schema:', error);
        process.exit(1);
    }
}

updateServicesSchema();
