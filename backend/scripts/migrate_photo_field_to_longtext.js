const { masterPool } = require('../config/database');

async function migratePhotoFieldToLongText() {
  console.log('🔄 Starting migration: Update student_photo field to LONGTEXT...');

  try {
    // Check current column type
    const [columns] = await masterPool.query(`
      SHOW COLUMNS FROM students WHERE Field = 'student_photo'
    `);

    if (columns.length === 0) {
      console.log('❌ student_photo column not found');
      return;
    }

    const currentType = columns[0].Type;
    console.log(`📋 Current student_photo column type: ${currentType}`);

    // Only migrate if it's not already LONGTEXT
    if (currentType !== 'longtext') {
      console.log('🔄 Migrating student_photo column to LONGTEXT...');

      // Alter table to change column type
      await masterPool.query(`
        ALTER TABLE students MODIFY COLUMN student_photo LONGTEXT
      `);

      console.log('✅ Successfully migrated student_photo column to LONGTEXT');

      // Check for existing data and log summary
      const [existingPhotos] = await masterPool.query(`
        SELECT COUNT(*) as count FROM students
        WHERE student_photo IS NOT NULL
        AND student_photo != ''
        AND student_photo != '{}'
      `);

      console.log(`📊 Found ${existingPhotos[0].count} existing photo records`);
      console.log('ℹ️  Note: Existing photo data may need to be converted to base64 format');
      console.log('   Consider running a script to convert existing file paths to base64 data URLs');

    } else {
      console.log('✅ student_photo column is already LONGTEXT');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePhotoFieldToLongText()
    .then(() => {
      console.log('🎉 Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migratePhotoFieldToLongText };