const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

async function fixDatabaseSchema() {
  console.log('🔧 Fixing database schema...');

  // Use hardcoded credentials for now
  const dbConfig = {
    host: 'student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com',
    user: 'admin',
    password: 'jzuy?28y_A8qB*x5OxdV)$h*90_A',
    database: 'student_database',
    ssl: { rejectUnauthorized: false }
  };

  console.log('📋 Database config:', {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    ssl: true
  });

  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('📋 Connected to database');

    // Check if admission_no column exists, add it if it doesn't
    console.log('📋 Checking if admission_no column exists...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students' AND COLUMN_NAME = 'admission_no'
    `, [dbConfig.database]);

    if (columns.length === 0) {
      console.log('📋 Adding missing admission_no column...');
      await connection.execute(`
        ALTER TABLE students
        ADD COLUMN admission_no VARCHAR(100) NULL AFTER admission_number
      `);
      console.log('✅ admission_no column added');
    } else {
      console.log('✅ admission_no column already exists');
    }

    // Add index for better performance (handle duplicate key error)
    console.log('📋 Adding index for admission_no...');
    try {
      await connection.execute(`
        ALTER TABLE students
        ADD INDEX idx_admission_no (admission_no)
      `);
      console.log('✅ Index added');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('✅ Index already exists');
      } else {
        throw error;
      }
    }

    // Verify the column exists
    console.log('📋 Verifying columns...');
    const [rows] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'students'
      AND COLUMN_NAME IN ('admission_number', 'admission_no', 'student_data', 'dob', 'adhar_no', 'student_name', 'father_name', 'student_mobile', 'parent_mobile1', 'parent_mobile2', 'admission_date', 'student_address', 'city_village', 'mandal_name', 'district', 'batch', 'branch', 'stud_type', 'student_status', 'scholar_status', 'caste', 'gender', 'remarks')
    `, [dbConfig.database]);

    console.log('📋 Current columns:');
    rows.forEach(row => {
      console.log(`  - ${row.COLUMN_NAME}: ${row.DATA_TYPE} ${row.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    // Check if any required columns are missing
    const requiredColumns = [
      'dob', 'adhar_no', 'student_name', 'father_name', 'student_mobile', 'parent_mobile1', 'parent_mobile2',
      'admission_date', 'student_address', 'city_village', 'mandal_name', 'district', 'batch', 'branch',
      'stud_type', 'student_status', 'scholar_status', 'caste', 'gender', 'remarks',
      'current_year', 'current_semester',
      // Admin-only columns that are missing
      'pin_no', 'previous_college', 'certificates_status'
    ];
    const existingColumns = rows.map(r => r.COLUMN_NAME);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('📋 Missing columns:', missingColumns);
      console.log('📋 Adding missing columns...');

      for (const column of missingColumns) {
        let columnDef = '';
        switch(column) {
          case 'dob':
          case 'admission_date':
            columnDef = `${column} VARCHAR(50) NULL`;
            break;
          case 'adhar_no':
            columnDef = `${column} VARCHAR(20) NULL`;
            break;
          case 'student_name':
          case 'father_name':
            columnDef = `${column} VARCHAR(255) NULL`;
            break;
          case 'student_mobile':
          case 'parent_mobile1':
          case 'parent_mobile2':
            columnDef = `${column} VARCHAR(20) NULL`;
            break;
          case 'student_address':
            columnDef = `${column} TEXT NULL`;
            break;
          case 'city_village':
          case 'mandal_name':
          case 'district':
          case 'batch':
          case 'branch':
          case 'stud_type':
          case 'student_status':
          case 'scholar_status':
          case 'caste':
          case 'gender':
          case 'remarks':
            columnDef = `${column} VARCHAR(100) NULL`;
            break;
          case 'current_year':
          case 'current_semester':
            columnDef = `${column} TINYINT NULL DEFAULT 1`;
            break;
          default:
            columnDef = `${column} VARCHAR(255) NULL`;
        }

        try {
          await connection.execute(`ALTER TABLE students ADD COLUMN ${columnDef}`);
          console.log(`✅ Added column: ${column}`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`✅ Column already exists: ${column}`);
          } else {
            console.error(`❌ Error adding column ${column}:`, error.message);
          }
        }
      }
    } else {
      console.log('✅ All required columns exist');
    }

    console.log('✅ Database schema fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing database schema:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

fixDatabaseSchema();
