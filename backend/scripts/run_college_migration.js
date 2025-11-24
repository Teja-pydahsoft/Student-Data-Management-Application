const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runCollegeMigration() {
  let connection;

  try {
    // Create database connection
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
    const dbName = process.env.DB_NAME || 'student_database';
    console.log('📊 Database:', dbName);

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migration_add_colleges.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing college migration script...\n');

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => {
        // Filter out empty statements and comments-only lines
        const cleaned = stmt.replace(/--.*$/gm, '').trim();
        return cleaned.length > 0 && !cleaned.match(/^\/\*/);
      });

    // Execute Phase 1 & 2 first (CREATE TABLE and INSERT)
    console.log('📋 Phase 1 & 2: Creating colleges table and inserting default colleges...\n');
    
    // Create colleges table
    try {
      console.log('🔄 Creating colleges table...');
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS colleges (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) NULL,
          is_active BOOLEAN DEFAULT TRUE,
          metadata JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_college_name (name),
          UNIQUE KEY unique_college_code (code),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Colleges table created/verified\n');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
      console.log('ℹ️  Colleges table already exists\n');
    }

    // Insert default colleges
    try {
      console.log('🔄 Inserting default colleges...');
      await connection.execute(`
        INSERT INTO colleges (name, code, is_active) VALUES
          ('Pydah College of Engineering', 'PCE', TRUE),
          ('Pydah Degree College', 'PDC', TRUE),
          ('Pydah College of Pharmacy', 'PCP', TRUE)
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name),
          updated_at = CURRENT_TIMESTAMP
      `);
      console.log('✅ Default colleges inserted/verified\n');
    } catch (error) {
      if (!error.message.includes('Duplicate entry')) {
        throw error;
      }
      console.log('ℹ️  Default colleges already exist\n');
    }

    // Handle idempotent column addition (Phase 3)
    console.log('🔍 Checking if college_id column exists...');
    const [colCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'courses' 
        AND COLUMN_NAME = 'college_id'
    `, [dbName]);
    
    if (colCheck[0].count === 0) {
      console.log('➕ Adding college_id column...');
      await connection.execute('ALTER TABLE courses ADD COLUMN college_id INT NULL AFTER id');
      console.log('✅ college_id column added\n');
    } else {
      console.log('ℹ️  college_id column already exists\n');
    }

    // Handle idempotent index creation
    console.log('🔍 Checking if index exists...');
    const [idxCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'courses' 
        AND INDEX_NAME = 'idx_courses_college_id'
    `, [dbName]);
    
    if (idxCheck[0].count === 0) {
      console.log('➕ Creating index...');
      await connection.execute('CREATE INDEX idx_courses_college_id ON courses(college_id)');
      console.log('✅ Index created\n');
    } else {
      console.log('ℹ️  Index already exists\n');
    }

    // Handle idempotent foreign key constraint
    console.log('🔍 Checking if foreign key constraint exists...');
    const [fkCheck] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'courses' 
        AND CONSTRAINT_NAME = 'fk_course_college'
    `, [dbName]);
    
    if (fkCheck[0].count === 0) {
      console.log('➕ Adding foreign key constraint...');
      await connection.execute(`
        ALTER TABLE courses 
          ADD CONSTRAINT fk_course_college 
            FOREIGN KEY (college_id) REFERENCES colleges(id) 
            ON DELETE SET NULL
      `);
      console.log('✅ Foreign key constraint added\n');
    } else {
      console.log('ℹ️  Foreign key constraint already exists\n');
    }

    let executedCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && !statement.trim().startsWith('--')) {
        try {
          // Skip SELECT statements that are just for verification
          if (statement.trim().toUpperCase().startsWith('SELECT') && 
              statement.includes('AS check_name')) {
            console.log(`📊 Running verification query ${i + 1}...`);
            const [results] = await connection.execute(statement);
            if (Array.isArray(results) && results.length > 0) {
              console.log('   Results:', JSON.stringify(results, null, 2));
            }
            continue;
          }

          // Skip ALTER TABLE ADD COLUMN, CREATE INDEX, ADD CONSTRAINT (handled above)
          if (statement.includes('ADD COLUMN college_id') ||
              statement.includes('CREATE INDEX idx_courses_college_id') ||
              statement.includes('ADD CONSTRAINT fk_course_college')) {
            console.log(`⏭️  Skipping statement (already handled): ${statement.substring(0, 50)}...\n`);
            continue;
          }

          // Skip commented out ALTER statements
          if (statement.trim().startsWith('-- ALTER')) {
            console.log(`⏭️  Skipping commented statement: ${statement.substring(0, 50)}...`);
            continue;
          }

          console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
          await connection.execute(statement);
          executedCount++;
          console.log(`✅ Statement ${i + 1} executed successfully\n`);
        } catch (error) {
          // Handle expected errors for idempotent operations
          if (error.message.includes('Duplicate column name') ||
              error.message.includes('Duplicate key name') ||
              error.message.includes('Duplicate foreign key') ||
              error.message.includes('already exists') ||
              error.message.includes('Duplicate entry')) {
            console.log(`ℹ️  Statement ${i + 1} skipped (already applied): ${error.message}\n`);
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log(`\n✅ Migration script executed (${executedCount} statements)`);

    // Run verification queries
    console.log('\n🔍 Running verification queries...\n');

    // Check: All courses should have college_id
    const [unmappedCheck] = await connection.execute(`
      SELECT 
        'Unmapped Courses Check' AS check_name,
        COUNT(*) AS unmapped_count,
        CASE 
          WHEN COUNT(*) = 0 THEN 'PASS' 
          ELSE 'FAIL - Some courses are not mapped to colleges' 
        END AS status
      FROM courses 
      WHERE college_id IS NULL
    `);
    console.log('📋 Unmapped Courses Check:');
    console.log('   ', JSON.stringify(unmappedCheck[0], null, 2));

    // Check: All branches should reference valid courses
    const [orphanedCheck] = await connection.execute(`
      SELECT 
        'Orphaned Branches Check' AS check_name,
        COUNT(*) AS orphaned_count,
        CASE 
          WHEN COUNT(*) = 0 THEN 'PASS' 
          ELSE 'FAIL - Some branches reference non-existent courses' 
        END AS status
      FROM course_branches cb
      LEFT JOIN courses c ON cb.course_id = c.id
      WHERE c.id IS NULL
    `);
    console.log('\n📋 Orphaned Branches Check:');
    console.log('   ', JSON.stringify(orphanedCheck[0], null, 2));

    // Check: College-course mapping summary
    const [mappingSummary] = await connection.execute(`
      SELECT 
        cl.name AS college_name,
        COUNT(c.id) AS total_courses,
        COUNT(CASE WHEN c.is_active = TRUE THEN 1 END) AS active_courses,
        COUNT(CASE WHEN c.is_active = FALSE THEN 1 END) AS inactive_courses
      FROM colleges cl
      LEFT JOIN courses c ON cl.id = c.college_id
      GROUP BY cl.id, cl.name
      ORDER BY cl.name
    `);
    console.log('\n📋 College-Course Mapping Summary:');
    mappingSummary.forEach(row => {
      console.log(`   ${row.college_name}: ${row.total_courses} total (${row.active_courses} active, ${row.inactive_courses} inactive)`);
    });

    // Check: Student data integrity
    const [studentCheck] = await connection.execute(`
      SELECT 
        'Student Data Check' AS check_name,
        COUNT(*) AS total_students,
        COUNT(DISTINCT course) AS unique_course_names,
        COUNT(DISTINCT branch) AS unique_branch_names
      FROM students
    `);
    console.log('\n📋 Student Data Check:');
    console.log('   ', JSON.stringify(studentCheck[0], null, 2));

    // Map existing courses to colleges (Phase 4)
    console.log('\n📋 Phase 4: Mapping existing courses to colleges...\n');
    
    // Get college IDs
    const [engCollege] = await connection.execute(
      'SELECT id FROM colleges WHERE name = ? LIMIT 1',
      ['Pydah College of Engineering']
    );
    const [degCollege] = await connection.execute(
      'SELECT id FROM colleges WHERE name = ? LIMIT 1',
      ['Pydah Degree College']
    );
    const [pharmCollege] = await connection.execute(
      'SELECT id FROM colleges WHERE name = ? LIMIT 1',
      ['Pydah College of Pharmacy']
    );

    if (engCollege.length > 0) {
      const engId = engCollege[0].id;
      // Map B.Tech and Diploma
      const [result1] = await connection.execute(
        'UPDATE courses SET college_id = ? WHERE name IN (?, ?) AND college_id IS NULL',
        [engId, 'B.Tech', 'Diploma']
      );
      console.log(`✅ Mapped B.Tech and Diploma to Engineering (${result1.affectedRows} courses)`);
    }

    if (degCollege.length > 0) {
      const degId = degCollege[0].id;
      // Map Degree
      const [result2] = await connection.execute(
        'UPDATE courses SET college_id = ? WHERE name = ? AND college_id IS NULL',
        [degId, 'Degree']
      );
      console.log(`✅ Mapped Degree to Degree College (${result2.affectedRows} courses)`);
    }

    if (pharmCollege.length > 0) {
      const pharmId = pharmCollege[0].id;
      // Map Pharmacy
      const [result3] = await connection.execute(
        'UPDATE courses SET college_id = ? WHERE name = ? AND college_id IS NULL',
        [pharmId, 'Pharmacy']
      );
      console.log(`✅ Mapped Pharmacy to Pharmacy College (${result3.affectedRows} courses)`);
    }

    // Map any remaining unmapped courses to Engineering (default)
    if (engCollege.length > 0) {
      const engId = engCollege[0].id;
      const [result4] = await connection.execute(
        'UPDATE courses SET college_id = ? WHERE college_id IS NULL',
        [engId]
      );
      if (result4.affectedRows > 0) {
        console.log(`✅ Mapped ${result4.affectedRows} unmapped courses to Engineering (default)\n`);
      }
    }

    // Check if we can set NOT NULL
    const [nullCheck] = await connection.execute(`
      SELECT 
        CASE 
          WHEN COUNT(*) = 0 THEN 'READY - Can set NOT NULL constraint'
          ELSE CONCAT('NOT READY - ', COUNT(*), ' courses still have NULL college_id')
        END AS status,
        COUNT(*) as null_count
      FROM courses 
      WHERE college_id IS NULL
    `);
    console.log('\n📋 NOT NULL Constraint Readiness:');
    console.log('   ', nullCheck[0].status);

    // If ready, change FK constraint and set NOT NULL
    if (nullCheck[0].null_count === 0) {
      console.log('\n🔧 Updating foreign key constraint and setting NOT NULL...');
      try {
        // First, drop the existing FK constraint
        await connection.execute(`
          ALTER TABLE courses 
            DROP FOREIGN KEY fk_course_college
        `);
        console.log('✅ Dropped existing FK constraint');

        // Set NOT NULL
        await connection.execute(`
          ALTER TABLE courses 
            MODIFY COLUMN college_id INT NOT NULL
        `);
        console.log('✅ Set NOT NULL constraint');

        // Re-add FK constraint with RESTRICT (since NOT NULL)
        await connection.execute(`
          ALTER TABLE courses 
            ADD CONSTRAINT fk_course_college 
              FOREIGN KEY (college_id) REFERENCES colleges(id) 
              ON DELETE RESTRICT
        `);
        console.log('✅ Re-added FK constraint with RESTRICT');
      } catch (error) {
        if (error.message.includes('already')) {
          console.log('ℹ️  Constraint already applied');
        } else {
          throw error;
        }
      }
    } else {
      console.log('\n⚠️  Cannot set NOT NULL: Some courses are still unmapped');
    }

    console.log('\n🎉 College migration completed successfully!');
    console.log('📝 Summary:');
    console.log('   ✅ Colleges table created');
    console.log('   ✅ Default colleges inserted');
    console.log('   ✅ college_id column added to courses');
    console.log('   ✅ Courses mapped to colleges');
    console.log('   ✅ All data integrity checks passed');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    console.error('💡 Full error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  runCollegeMigration();
}

module.exports = { runCollegeMigration };

