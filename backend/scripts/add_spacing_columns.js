const { masterPool } = require('../config/database');

async function addSpacingColumns() {
    try {
        console.log('🔄 Adding spacing columns to certificate_templates table...');

        const columnsToAdd = [
            { name: 'top_spacing', type: 'INT DEFAULT 20' },
            { name: 'middle_spacing', type: 'INT DEFAULT 20' },
            { name: 'bottom_spacing', type: 'INT DEFAULT 20' }
        ];

        for (const col of columnsToAdd) {
            try {
                await masterPool.execute(`ALTER TABLE certificate_templates ADD COLUMN ${col.name} ${col.type}`);
                console.log(`  ✅ Added ${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_COLUMN_NAME') {
                    console.log(`  ℹ️ Column ${col.name} already exists`);
                } else {
                    throw err;
                }
            }
        }

        console.log('✅ Spacing columns added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding columns:', error);
        process.exit(1);
    }
}

addSpacingColumns();
