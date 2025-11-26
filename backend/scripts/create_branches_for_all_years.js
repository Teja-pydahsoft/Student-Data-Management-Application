/**
 * Script to create branches for all active academic years
 * 
 * This script will:
 * 1. Get all active academic years (2022, 2023, 2024, 2025, 2026)
 * 2. For each course, ensure branches exist for all academic years
 * 
 * Run with: node scripts/create_branches_for_all_years.js
 */

const { masterPool } = require('../config/database');

async function createBranchesForAllYears() {
  console.log('🔄 Creating branches for all academic years...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Get all active academic years
    const [academicYears] = await connection.query(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label ASC'
    );
    
    console.log(`📅 Found ${academicYears.length} active academic years:`);
    academicYears.forEach(y => console.log(`   - ${y.year_label} (ID: ${y.id})`));
    
    // Get all courses
    const [courses] = await connection.query(
      'SELECT * FROM courses WHERE is_active = 1'
    );
    
    console.log(`\n📚 Found ${courses.length} active courses`);
    
    // Get all existing branches (we'll use these as templates)
    const [existingBranches] = await connection.query(`
      SELECT DISTINCT cb.course_id, cb.name, cb.total_years, cb.semesters_per_year, cb.is_active
      FROM course_branches cb
      GROUP BY cb.course_id, cb.name
    `);
    
    console.log(`\n🌿 Found ${existingBranches.length} unique branch templates`);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    // For each academic year, ensure all branches exist
    for (const year of academicYears) {
      console.log(`\n📦 Processing academic year: ${year.year_label}`);
      
      for (const branch of existingBranches) {
        // Check if this branch already exists for this academic year
        const [existing] = await connection.query(`
          SELECT id FROM course_branches 
          WHERE course_id = ? AND name = ? AND academic_year_id = ?
        `, [branch.course_id, branch.name, year.id]);
        
        if (existing.length > 0) {
          skippedCount++;
          continue; // Already exists
        }
        
        // Check if branch exists without academic year (from our previous sync)
        const [withoutYear] = await connection.query(`
          SELECT id FROM course_branches 
          WHERE course_id = ? AND name = ? AND academic_year_id IS NULL
        `, [branch.course_id, branch.name]);
        
        if (withoutYear.length > 0) {
          // Update the existing one to have the first year, then create copies for others
          if (year.id === academicYears[0].id) {
            await connection.query(
              'UPDATE course_branches SET academic_year_id = ? WHERE id = ?',
              [year.id, withoutYear[0].id]
            );
            console.log(`   ✅ Updated: ${branch.name} -> ${year.year_label}`);
            createdCount++;
            continue;
          }
        }
        
        // Create new branch for this academic year
        await connection.query(`
          INSERT INTO course_branches (course_id, name, total_years, semesters_per_year, academic_year_id, is_active)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          branch.course_id,
          branch.name,
          branch.total_years,
          branch.semesters_per_year,
          year.id,
          branch.is_active
        ]);
        
        console.log(`   ✅ Created: ${branch.name} for ${year.year_label}`);
        createdCount++;
      }
    }
    
    console.log('\n🎉 Process completed!');
    console.log(`   - Created/Updated: ${createdCount} branch(es)`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);
    
    // Show final summary
    const [summary] = await connection.query(`
      SELECT 
        ay.year_label,
        COUNT(cb.id) as branch_count
      FROM academic_years ay
      LEFT JOIN course_branches cb ON cb.academic_year_id = ay.id
      WHERE ay.is_active = 1
      GROUP BY ay.id, ay.year_label
      ORDER BY ay.year_label ASC
    `);
    
    console.log('\n📊 Final Summary by Academic Year:');
    for (const row of summary) {
      console.log(`   ${row.year_label}: ${row.branch_count} branch(es)`);
    }
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

createBranchesForAllYears().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

