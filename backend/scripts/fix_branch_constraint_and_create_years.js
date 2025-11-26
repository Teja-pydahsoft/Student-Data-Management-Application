/**
 * Script to:
 * 1. Update the unique constraint to include academic_year_id
 * 2. Create branches for all active academic years
 * 
 * Run with: node scripts/fix_branch_constraint_and_create_years.js
 */

const { masterPool } = require('../config/database');

async function fixConstraintAndCreateBranches() {
  console.log('🔄 Fixing branch constraint and creating branches for all academic years...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Step 1: Drop the old unique constraint and create a new one
    console.log('\n📦 Step 1: Updating unique constraint...');
    
    try {
      // Try to drop the existing unique constraint
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
    
    // Step 2: Get all active academic years
    console.log('\n📦 Step 2: Getting academic years...');
    const [academicYears] = await connection.query(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label ASC'
    );
    
    console.log(`   Found ${academicYears.length} active academic years:`);
    academicYears.forEach(y => console.log(`   - ${y.year_label} (ID: ${y.id})`));
    
    // Step 3: Get all unique branch templates (one per course+name combination)
    console.log('\n📦 Step 3: Getting branch templates...');
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
    
    // Step 4: Create branches for all academic years
    console.log('\n📦 Step 4: Creating branches for all academic years...');
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const year of academicYears) {
      console.log(`\n   📅 Processing ${year.year_label}:`);
      
      for (const template of branchTemplates) {
        // Check if this exact combination already exists
        const [existing] = await connection.query(`
          SELECT id FROM course_branches 
          WHERE course_id = ? AND name = ? AND academic_year_id = ?
        `, [template.course_id, template.name, year.id]);
        
        if (existing.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Create the branch
        await connection.query(`
          INSERT INTO course_branches (course_id, name, total_years, semesters_per_year, academic_year_id, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [
          template.course_id,
          template.name,
          template.total_years,
          template.semesters_per_year,
          year.id
        ]);
        
        console.log(`      ✅ ${template.course_name} - ${template.name}`);
        createdCount++;
      }
    }
    
    // Step 5: Clean up any branches without academic year
    console.log('\n📦 Step 5: Cleaning up branches without academic year...');
    const [orphanBranches] = await connection.query(`
      SELECT id, name FROM course_branches WHERE academic_year_id IS NULL
    `);
    
    if (orphanBranches.length > 0) {
      // Get the default year (2025)
      const [defaultYear] = await connection.query(
        'SELECT id FROM academic_years WHERE year_label = ? LIMIT 1',
        ['2025']
      );
      
      if (defaultYear.length > 0) {
        for (const orphan of orphanBranches) {
          // Check if we can update it or if duplicate would occur
          const [wouldDuplicate] = await connection.query(`
            SELECT id FROM course_branches 
            WHERE course_id = (SELECT course_id FROM course_branches WHERE id = ?)
            AND name = ? AND academic_year_id = ?
          `, [orphan.id, orphan.name, defaultYear[0].id]);
          
          if (wouldDuplicate.length > 0) {
            // Delete the orphan since we already have one with academic year
            await connection.query('DELETE FROM course_branches WHERE id = ?', [orphan.id]);
            console.log(`   🗑️  Deleted duplicate orphan: ${orphan.name}`);
          } else {
            // Update to have the default year
            await connection.query(
              'UPDATE course_branches SET academic_year_id = ? WHERE id = ?',
              [defaultYear[0].id, orphan.id]
            );
            console.log(`   ✅ Updated orphan: ${orphan.name} -> 2025`);
          }
        }
      }
    } else {
      console.log('   ✅ No orphan branches found');
    }
    
    // Final Summary
    console.log('\n🎉 Process completed!');
    console.log(`   - Created: ${createdCount} branch(es)`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);
    
    const [summary] = await connection.query(`
      SELECT 
        ay.year_label,
        COUNT(cb.id) as branch_count
      FROM academic_years ay
      LEFT JOIN course_branches cb ON cb.academic_year_id = ay.id AND cb.is_active = 1
      WHERE ay.is_active = 1
      GROUP BY ay.id, ay.year_label
      ORDER BY ay.year_label ASC
    `);
    
    console.log('\n📊 Final Summary by Academic Year:');
    for (const row of summary) {
      console.log(`   ${row.year_label}: ${row.branch_count} branch(es)`);
    }
    
    // Total branches
    const [totalCount] = await connection.query('SELECT COUNT(*) as total FROM course_branches WHERE is_active = 1');
    console.log(`\n   Total active branches: ${totalCount[0].total}`);
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

fixConstraintAndCreateBranches().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

