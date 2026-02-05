const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixCourseConstraint() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database'
    });

    console.log('🔍 Checking current constraints on courses table...\n');

    // Check current indexes
    const [indexes] = await connection.query(
      "SHOW INDEXES FROM courses WHERE Key_name LIKE 'unique_course%'"
    );

    console.log('Current unique constraints:');
    const constraintMap = {};
    indexes.forEach(idx => {
      if (!constraintMap[idx.Key_name]) {
        constraintMap[idx.Key_name] = [];
      }
      constraintMap[idx.Key_name].push(idx.Column_name);
    });

    Object.keys(constraintMap).forEach(key => {
      console.log(`  - ${key}: (${constraintMap[key].join(', ')})`);
    });

    // Check if old constraint exists
    const oldConstraintExists = indexes.some(idx => idx.Key_name === 'unique_course_name');
    const newConstraintExists = indexes.some(idx => idx.Key_name === 'unique_course_name_college');

    console.log('\n📊 Status:');
    console.log(`  Old constraint (unique_course_name): ${oldConstraintExists ? '❌ EXISTS' : '✅ REMOVED'}`);
    console.log(`  New constraint (unique_course_name_college): ${newConstraintExists ? '✅ EXISTS' : '❌ MISSING'}`);

    if (oldConstraintExists) {
      console.log('\n🔧 Dropping old constraint...');
      try {
        await connection.query('ALTER TABLE courses DROP INDEX unique_course_name');
        console.log('✅ Old constraint dropped successfully');
      } catch (error) {
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY' || error.message.includes("doesn't exist")) {
          console.log('⚠️  Constraint already removed (or error accessing it)');
        } else {
          throw error;
        }
      }
    }

    if (!newConstraintExists) {
      console.log('\n🔧 Adding new composite constraint...');
      try {
        // Check if college_id column exists
        const [columns] = await connection.query(
          "SHOW COLUMNS FROM courses LIKE 'college_id'"
        );
        
        if (columns.length === 0) {
          console.log('⚠️  college_id column does not exist. Adding it...');
          await connection.query('ALTER TABLE courses ADD COLUMN college_id INT NULL AFTER id');
          console.log('✅ college_id column added');
        }

        // Add index on college_id if it doesn't exist
        const [indexes2] = await connection.query(
          "SHOW INDEXES FROM courses WHERE Key_name = 'idx_college_id'"
        );
        if (indexes2.length === 0) {
          await connection.query('ALTER TABLE courses ADD INDEX idx_college_id (college_id)');
          console.log('✅ Index on college_id added');
        }

        await connection.query(
          'ALTER TABLE courses ADD UNIQUE KEY unique_course_name_college (college_id, name)'
        );
        console.log('✅ New composite constraint added successfully');
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('already exists')) {
          console.log('⚠️  Constraint already exists');
        } else {
          throw error;
        }
      }
    }

    // Verify final state
    console.log('\n🔍 Verifying final state...');
    const [finalIndexes] = await connection.query(
      "SHOW INDEXES FROM courses WHERE Key_name LIKE 'unique_course%'"
    );

    const finalConstraintMap = {};
    finalIndexes.forEach(idx => {
      if (!finalConstraintMap[idx.Key_name]) {
        finalConstraintMap[idx.Key_name] = [];
      }
      finalConstraintMap[idx.Key_name].push(idx.Column_name);
    });

    console.log('\n✅ Final constraints:');
    Object.keys(finalConstraintMap).forEach(key => {
      console.log(`  - ${key}: (${finalConstraintMap[key].join(', ')})`);
    });

    const oldStillExists = finalIndexes.some(idx => idx.Key_name === 'unique_course_name');
    const newExists = finalIndexes.some(idx => idx.Key_name === 'unique_course_name_college');

    if (oldStillExists) {
      console.log('\n❌ ERROR: Old constraint still exists!');
      process.exit(1);
    } else if (!newExists) {
      console.log('\n❌ ERROR: New constraint missing!');
      process.exit(1);
    } else {
      console.log('\n✅ SUCCESS: Constraint migration completed correctly!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixCourseConstraint();

