const { masterPool } = require('../config/database');

async function updateCollegesTableForBlobImages() {
    try {
        console.log('🔄 Updating colleges table to store images as BLOB...');

        // Check and drop old columns if they exist
        const [columns] = await masterPool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'colleges' 
            AND COLUMN_NAME IN ('header_image_url', 'footer_image_url')
        `);

        if (columns.length > 0) {
            console.log('Dropping old image URL columns...');
            for (const col of columns) {
                await masterPool.execute(`ALTER TABLE colleges DROP COLUMN ${col.COLUMN_NAME}`);
                console.log(`  ✓ Dropped ${col.COLUMN_NAME}`);
            }
        }

        // Add new LONGBLOB columns for images
        console.log('Adding BLOB columns for images...');
        await masterPool.execute(`
            ALTER TABLE colleges 
            ADD COLUMN header_image LONGBLOB DEFAULT NULL,
            ADD COLUMN footer_image LONGBLOB DEFAULT NULL,
            ADD COLUMN header_image_type VARCHAR(50) DEFAULT NULL,
            ADD COLUMN footer_image_type VARCHAR(50) DEFAULT NULL
        `);

        console.log('✅ Colleges table updated successfully!');
        console.log('Images will now be stored directly in the database.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating colleges table:', error);
        process.exit(1);
    }
}

updateCollegesTableForBlobImages();

