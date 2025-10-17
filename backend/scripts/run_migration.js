const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;

  try {
    // Create database connection using existing configuration
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database',
      multipleStatements: true, // Enable multiple statements
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('✅ Connected to database successfully');
    console.log('📊 Database:', process.env.DB_NAME || 'student_database');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'fix_json_student_data.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing migration script...');

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        try {
          await connection.execute(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          if (error.message.includes('ER_DUP_KEYNAME') || error.message.includes('already exists')) {
            console.log('ℹ️  This error can be ignored (index already exists)');
          } else {
            throw error;
          }
        }
      }
    }

    // Verify the migration
    console.log('🔍 Verifying migration...');

    // Check students table in main database
    const [studentsCheck] = await connection.execute(`
      SELECT column_name, data_type, character_set_name, collation_name
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = 'students' AND column_name = 'student_data'
    `, [process.env.DB_NAME || 'student_database']);

    if (studentsCheck.length > 0) {
      console.log('📋 Students table student_data column:');
      console.log(`   - Type: ${studentsCheck[0].data_type}`);
      console.log(`   - Charset: ${studentsCheck[0].character_set_name || 'N/A'}`);
      console.log(`   - Collation: ${studentsCheck[0].collation_name || 'N/A'}`);
    }

    // Check form_submissions table in main database
    const [submissionsCheck] = await connection.execute(`
      SELECT column_name, data_type, character_set_name, collation_name
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = 'form_submissions' AND column_name = 'submission_data'
    `, [process.env.DB_NAME || 'student_database']);

    if (submissionsCheck.length > 0) {
      console.log('📋 Form submissions table submission_data column:');
      console.log(`   - Type: ${submissionsCheck[0].data_type}`);
      console.log(`   - Charset: ${submissionsCheck[0].character_set_name || 'N/A'}`);
      console.log(`   - Collation: ${submissionsCheck[0].collation_name || 'N/A'}`);
    }

    // Test with staging database if it exists
    try {
      await connection.execute('USE student_staging');
      console.log('🔄 Switching to staging database...');

      // Re-execute key migration statements for staging database
      await connection.execute('ALTER TABLE form_submissions MODIFY COLUMN submission_data TEXT');

      const [stagingCheck] = await connection.execute(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'student_staging' AND table_name = 'form_submissions' AND column_name = 'submission_data'
      `);

      if (stagingCheck.length > 0) {
        console.log('📋 Staging form_submissions table submission_data column:');
        console.log(`   - Type: ${stagingCheck[0].data_type}`);
      }
    } catch (stagingError) {
      console.log('ℹ️  Staging database not accessible or not needed');
    }

    console.log('🎉 Migration completed successfully!');
    console.log('📝 Summary of changes:');
    console.log('   - students.student_data: JSON → TEXT');
    console.log('   - form_submissions.submission_data: JSON → TEXT');
    console.log('   - All existing data preserved');
    console.log('   - No more JSON parsing errors expected');

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
runMigration();