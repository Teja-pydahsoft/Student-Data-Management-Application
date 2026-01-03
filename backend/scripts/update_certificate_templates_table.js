const { masterPool } = require('../config/database');

async function updateCertificateTemplatesTable() {
    try {
        console.log('🔄 Updating certificate_templates table...\n');

        // Check if columns exist
        const [columns] = await masterPool.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'certificate_templates' 
            AND COLUMN_NAME IN ('header_image_url', 'footer_image_url')
        `);

        if (columns.length > 0) {
            console.log('Removing redundant image columns from certificate_templates...');
            for (const col of columns) {
                await masterPool.execute(`ALTER TABLE certificate_templates DROP COLUMN ${col.COLUMN_NAME}`);
                console.log(`  ✓ Dropped ${col.COLUMN_NAME}`);
            }
        } else {
            console.log('✓ Image columns already removed');
        }

        console.log('\n✅ certificate_templates table updated!');
        console.log('Images will now be fetched from the colleges table based on college_id');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateCertificateTemplatesTable();
