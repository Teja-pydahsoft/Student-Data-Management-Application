const { masterPool } = require('../config/database');

async function checkImageStorage() {
    try {
        console.log('🔍 Checking image storage methods...\n');

        // Check students table structure
        console.log('📊 STUDENTS TABLE:');
        const [studentCols] = await masterPool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'students' 
            AND COLUMN_NAME LIKE '%photo%' OR COLUMN_NAME LIKE '%image%' OR COLUMN_NAME LIKE '%picture%'
        `);
        console.table(studentCols);

        // Check colleges table structure
        console.log('\n📊 COLLEGES TABLE:');
        const [collegeCols] = await masterPool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'colleges' 
            AND (COLUMN_NAME LIKE '%image%' OR COLUMN_NAME LIKE '%photo%')
        `);
        console.table(collegeCols);

        // Check certificate_templates table
        console.log('\n📊 CERTIFICATE_TEMPLATES TABLE:');
        const [templateCols] = await masterPool.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'certificate_templates'
            ORDER BY ORDINAL_POSITION
        `);
        console.table(templateCols);

        // Check if certificate_templates table is being used
        console.log('\n📈 CERTIFICATE TEMPLATES USAGE:');
        const [templateCount] = await masterPool.execute(`
            SELECT COUNT(*) as count FROM certificate_templates
        `);
        console.log(`Total templates: ${templateCount[0].count}`);

        if (templateCount[0].count > 0) {
            const [templates] = await masterPool.execute(`
                SELECT id, service_id, college_id, is_active 
                FROM certificate_templates 
                LIMIT 5
            `);
            console.table(templates);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkImageStorage();
