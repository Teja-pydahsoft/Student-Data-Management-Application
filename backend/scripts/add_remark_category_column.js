const { masterPool } = require('../config/database');

const migrate = async () => {
    try {
        console.log('🔄 Checking student_remarks table for remark_category column...');

        const [rows] = await masterPool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'student_remarks' 
            AND COLUMN_NAME = 'remark_category'
        `);

        if (rows.length === 0) {
            console.log('➕ Adding remark_category column...');
            await masterPool.query(`
                ALTER TABLE student_remarks 
                ADD COLUMN remark_category VARCHAR(50) DEFAULT 'Other' AFTER remark
            `);
            console.log('✅ Column added successfully.');
        } else {
            console.log('ℹ️ Column already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrate();
