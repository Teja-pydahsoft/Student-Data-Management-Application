const { masterPool } = require('../config/database');

async function updateCollegesTable() {
    try {
        console.log('🔄 Adding header and footer image columns to colleges table...');

        // Check if header_image_url column exists
        const [headerCheck] = await masterPool.execute(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'colleges' 
            AND COLUMN_NAME = 'header_image_url'
        `);

        if (headerCheck[0].count === 0) {
            await masterPool.execute(`
                ALTER TABLE colleges 
                ADD COLUMN header_image_url VARCHAR(500) DEFAULT NULL
            `);
            console.log('✅ Added header_image_url column');
        } else {
            console.log('ℹ️  header_image_url column already exists');
        }

        // Check if footer_image_url column exists
        const [footerCheck] = await masterPool.execute(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'colleges' 
            AND COLUMN_NAME = 'footer_image_url'
        `);

        if (footerCheck[0].count === 0) {
            await masterPool.execute(`
                ALTER TABLE colleges 
                ADD COLUMN footer_image_url VARCHAR(500) DEFAULT NULL
            `);
            console.log('✅ Added footer_image_url column');
        } else {
            console.log('ℹ️  footer_image_url column already exists');
        }

        console.log('✅ Colleges table updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating colleges table:', error);
        process.exit(1);
    }
}

updateCollegesTable();

