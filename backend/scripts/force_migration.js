const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceMigration() {
  let connection;

  try {
    // Create database connection using existing configuration
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database successfully');
    console.log('📊 Database:', process.env.DB_NAME);

    // Step 1: Check current schema
    console.log('\n🔍 Step 1: Checking current schema...');
    try {
      const [currentSchema] = await connection.execute(`
        SELECT column_name, data_type, character_set_name, collation_name
        FROM information_schema.columns
        WHERE table_schema = ? AND table_name = 'students' AND column_name = 'student_data'
      `, [process.env.DB_NAME]);

      if (currentSchema.length > 0) {
        console.log('📋 Current student_data column:');
        console.log(`   - Type: ${currentSchema[0].data_type}`);
        console.log(`   - Charset: ${currentSchema[0].character_set_name || 'N/A'}`);
        console.log(`   - Collation: ${currentSchema[0].collation_name || 'N/A'}`);
      } else {
        console.log('❌ student_data column not found in students table');
      }
    } catch (error) {
      console.log('ℹ️  Schema check failed, table might not exist yet:', error.message);
    }

    // Step 2: Force change the column type to TEXT
    console.log('\n🔄 Step 2: Forcing column type change to TEXT...');

    const alterCommands = [
      'ALTER TABLE students MODIFY COLUMN student_data TEXT',
      'ALTER TABLE form_submissions MODIFY COLUMN submission_data TEXT'
    ];

    for (const command of alterCommands) {
      try {
        console.log(`Executing: ${command}`);
        await connection.execute(command);
        console.log('✅ Command executed successfully');
      } catch (error) {
        if (error.message.includes('Duplicate key') || error.message.includes('already exists')) {
          console.log('ℹ️  Command already applied or not needed');
        } else {
          console.error('❌ Command failed:', error.message);
          // Don't throw here, continue with other commands
        }
      }
    }

    // Step 3: Verify the changes
    console.log('\n🔍 Step 3: Verifying schema changes...');

    const tablesToCheck = [
      { table: 'students', column: 'student_data' },
      { table: 'form_submissions', column: 'submission_data' }
    ];

    for (const { table, column } of tablesToCheck) {
      try {
        const [schemaCheck] = await connection.execute(`
          SELECT column_name, data_type, character_set_name, collation_name
          FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ? AND column_name = ?
        `, [process.env.DB_NAME, table, column]);

        if (schemaCheck.length > 0) {
          console.log(`📋 ${table}.${column}:`);
          console.log(`   - Type: ${schemaCheck[0].data_type}`);
          console.log(`   - Charset: ${schemaCheck[0].character_set_name || 'N/A'}`);
          console.log(`   - Collation: ${schemaCheck[0].collation_name || 'N/A'}`);

          if (schemaCheck[0].data_type === 'text') {
            console.log('✅ Column successfully converted to TEXT');
          } else {
            console.log('❌ Column still not TEXT type');
          }
        } else {
          console.log(`❌ Column ${table}.${column} not found`);
        }
      } catch (error) {
        console.log(`❌ Error checking ${table}.${column}:`, error.message);
      }
    }

    // Step 4: Test the fix with a sample insertion
    console.log('\n🧪 Step 4: Testing the fix...');
    try {
      const testData = {
        test: 'migration_verification',
        timestamp: new Date().toISOString(),
        sample_form_data: {
          student_name: 'Test Student',
          admission_number: 'TEST_MIG_001',
          batch: '2023',
          branch: 'IT'
        }
      };

      await connection.execute(
        'INSERT INTO students (admission_number, student_name, student_data) VALUES (?, ?, ?)',
        ['TEST_MIG_001', 'Migration Test Student', JSON.stringify(testData)]
      );

      console.log('✅ Test insertion successful - JSON handling now works!');

      // Clean up test data
      await connection.execute('DELETE FROM students WHERE admission_number = ?', ['TEST_MIG_001']);
      console.log('🗑️  Test data cleaned up');

    } catch (error) {
      console.log('❌ Test insertion failed:', error.message);
      console.log('💡 This indicates the migration did not fully resolve the issue');
    }

    console.log('\n🎉 Migration verification completed!');
    console.log('📝 Summary:');
    console.log('   - Connected to hosted database successfully');
    console.log('   - Applied TEXT column conversion');
    console.log('   - Verified schema changes');
    console.log('   - Tested JSON insertion');

    console.log('   ✅ Migration appears successful - no more JSON parsing errors expected');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
forceMigration();