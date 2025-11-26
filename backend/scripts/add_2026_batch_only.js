/**
 * Script to add ONLY 2026 batch and create branches for it
 * - Creates academic_years table if not exists
 * - Updates unique constraint to allow same branch across years
 * - Adds 2026 year only
 * - Creates branches for 2026 based on existing branch templates
 * 
 * Run with: node scripts/add_2026_batch_only.js
 */

const { masterPool } = require('../config/database');

async function add2026BatchOnly() {
  console.log('🔄 Adding 2026 batch and creating branches...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Step 1: Create academic_years table if not exists
    console.log('📦 Step 1: Ensuring academic_years table exists...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id INT PRIMARY KEY AUTO_INCREMENT,
        year_label VARCHAR(20) NOT NULL UNIQUE,
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_year_label (year_label),
        INDEX idx_is_active (is_active)
      )
    `);
    console.log('   ✅ academic_years table ready');

    // Step 2: Check if academic_year_id column exists in course_branches
    console.log('\n📦 Step 2: Ensuring course_branches has academic_year_id column...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'course_branches' 
        AND COLUMN_NAME = 'academic_year_id'
    `);

    if (columns.length === 0) {
      await connection.query(`
        ALTER TABLE course_branches
        ADD COLUMN academic_year_id INT NULL
      `);
      console.log('   ✅ academic_year_id column added');

      // Add foreign key constraint
      try {
        await connection.query(`
          ALTER TABLE course_branches
          ADD CONSTRAINT fk_branch_academic_year
            FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
            ON DELETE SET NULL
        `);
        console.log('   ✅ Foreign key constraint added');
      } catch (fkError) {
        console.log('   ⚠️  Foreign key constraint already exists or could not be added');
      }

      // Add index
      try {
        await connection.query(`
          CREATE INDEX idx_branch_academic_year ON course_branches(academic_year_id)
        `);
        console.log('   ✅ Index created');
      } catch (idxError) {
        console.log('   ⚠️  Index already exists');
      }
    } else {
      console.log('   ✅ academic_year_id column already exists');
    }

    // Step 3: Update unique constraint to include academic_year_id
    console.log('\n📦 Step 3: Updating unique constraint to allow same branch across years...');
    try {
      // Drop the old unique constraint
      await connection.query(`
        ALTER TABLE course_branches DROP INDEX unique_branch_per_course
      `);
      console.log('   ✅ Dropped old unique constraint');
    } catch (err) {
      console.log('   ⚠️  Old constraint may not exist or already dropped');
    }
    
    // Create new unique constraint that includes academic_year_id
    try {
      await connection.query(`
        ALTER TABLE course_branches 
        ADD UNIQUE KEY unique_branch_per_course_year (course_id, name, academic_year_id)
      `);
      console.log('   ✅ Created new unique constraint (course_id, name, academic_year_id)');
    } catch (err) {
      console.log('   ⚠️  New constraint may already exist:', err.message);
    }

    // Step 4: Add 2026 to academic_years
    console.log('\n📦 Step 4: Adding 2026 academic year...');
    let yearId;
    try {
      const [insertResult] = await connection.query(`
        INSERT INTO academic_years (year_label, start_date, end_date, is_active) 
        VALUES ('2026', '2026-06-01', '2027-05-31', TRUE)
      `);
      yearId = insertResult.insertId;
      console.log(`   ✅ Added 2026 (ID: ${yearId})`);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        // Already exists, get its ID
        const [existing] = await connection.query(
          'SELECT id FROM academic_years WHERE year_label = ?',
          ['2026']
        );
        yearId = existing[0].id;
        console.log(`   ⚠️  2026 already exists (ID: ${yearId})`);
      } else {
        throw err;
      }
    }

    // Step 5: Get existing unique branch templates (branches without academic_year_id or get distinct names)
    console.log('\n📦 Step 5: Getting existing branch templates...');
    const [branchTemplates] = await connection.query(`
      SELECT 
        cb.course_id, 
        cb.name, 
        MAX(cb.total_years) as total_years, 
        MAX(cb.semesters_per_year) as semesters_per_year,
        c.name as course_name
      FROM course_branches cb
      JOIN courses c ON cb.course_id = c.id
      WHERE cb.is_active = 1
      GROUP BY cb.course_id, cb.name, c.name
    `);
    
    console.log(`   Found ${branchTemplates.length} unique branch templates`);

    // Step 6: Create branches for 2026
    console.log('\n📦 Step 6: Creating branches for 2026...');
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const template of branchTemplates) {
      // Check if this exact combination already exists for 2026
      const [existing] = await connection.query(`
        SELECT id FROM course_branches 
        WHERE course_id = ? AND name = ? AND academic_year_id = ?
      `, [template.course_id, template.name, yearId]);
      
      if (existing.length > 0) {
        skippedCount++;
        continue;
      }
      
      // Create the branch for 2026
      await connection.query(`
        INSERT INTO course_branches (course_id, name, total_years, semesters_per_year, academic_year_id, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `, [
        template.course_id,
        template.name,
        template.total_years,
        template.semesters_per_year,
        yearId
      ]);
      
      console.log(`   ✅ ${template.course_name} - ${template.name}`);
      createdCount++;
    }

    // Final Summary
    console.log('\n🎉 Process completed!');
    console.log(`   - Created: ${createdCount} branch(es) for 2026`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);

    // Show all years
    const [years] = await connection.query(`
      SELECT year_label, is_active FROM academic_years ORDER BY year_label ASC
    `);
    
    console.log('\n📊 Academic Years in database:');
    for (const year of years) {
      console.log(`   ${year.year_label} ${year.is_active ? '✓ Active' : '○ Inactive'}`);
    }

    // Total branches for 2026
    const [branchCount] = await connection.query(
      'SELECT COUNT(*) as total FROM course_branches WHERE academic_year_id = ? AND is_active = 1',
      [yearId]
    );
    console.log(`\n   Total branches for 2026: ${branchCount[0].total}`);
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

add2026BatchOnly().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
