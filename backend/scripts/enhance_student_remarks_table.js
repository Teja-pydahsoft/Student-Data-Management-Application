const { masterPool } = require('../config/database');

/**
 * Migration: Enhance student_remarks table with year/semester tracking
 * and updated_at field for edit tracking
 */
const migrate = async () => {
    try {
        console.log('🔄 Enhancing student_remarks table...');

        // Check if columns exist
        const [columns] = await masterPool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'student_remarks'
            AND COLUMN_NAME IN ('student_year', 'student_semester', 'updated_at', 'updated_by')
        `);

        const existingColumns = columns.map(col => col.COLUMN_NAME);

        // Add student_year column
        if (!existingColumns.includes('student_year')) {
            console.log('➕ Adding student_year column...');
            await masterPool.query(`
                ALTER TABLE student_remarks 
                ADD COLUMN student_year INT DEFAULT NULL AFTER remark_category
            `);
            console.log('✅ student_year column added');
        } else {
            console.log('ℹ️  student_year column already exists');
        }

        // Add student_semester column
        if (!existingColumns.includes('student_semester')) {
            console.log('➕ Adding student_semester column...');
            await masterPool.query(`
                ALTER TABLE student_remarks 
                ADD COLUMN student_semester INT DEFAULT NULL AFTER student_year
            `);
            console.log('✅ student_semester column added');
        } else {
            console.log('ℹ️  student_semester column already exists');
        }

        // Add updated_at column
        if (!existingColumns.includes('updated_at')) {
            console.log('➕ Adding updated_at column...');
            await masterPool.query(`
                ALTER TABLE student_remarks 
                ADD COLUMN updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at
            `);
            console.log('✅ updated_at column added');
        } else {
            console.log('ℹ️  updated_at column already exists');
        }

        // Add updated_by column
        if (!existingColumns.includes('updated_by')) {
            console.log('➕ Adding updated_by column...');
            await masterPool.query(`
                ALTER TABLE student_remarks 
                ADD COLUMN updated_by VARCHAR(255) DEFAULT NULL AFTER updated_at
            `);
            console.log('✅ updated_by column added');
        } else {
            console.log('ℹ️  updated_by column already exists');
        }

        console.log('✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

migrate();
