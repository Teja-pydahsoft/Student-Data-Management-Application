/**
 * Script to sync existing branches with academic years
 * 
 * This script will:
 * 1. Find all branches that don't have an academic_year_id assigned
 * 2. Assign them to the current/most recent academic year
 * 
 * Run with: node scripts/sync_branches_academic_years.js
 */

const { masterPool } = require('../config/database');

async function syncBranchesWithAcademicYears() {
  console.log('🔄 Starting branch-academic year sync...');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // First, check if we have academic years
    const [academicYears] = await connection.query(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label DESC'
    );
    
    if (academicYears.length === 0) {
      console.log('⚠️  No active academic years found. Creating default years...');
      
      // Create academic years for last 2 years, current year, and next 2 years
      const yearsToCreate = [
        currentYear - 2,
        currentYear - 1,
        currentYear,
        currentYear + 1,
        currentYear + 2
      ];
      
      for (const year of yearsToCreate) {
        try {
          await connection.query(`
            INSERT IGNORE INTO academic_years (year_label, start_date, end_date, is_active) 
            VALUES (?, ?, ?, TRUE)
          `, [
            year.toString(),
            `${year}-06-01`,
            `${year + 1}-05-31`
          ]);
          console.log(`   ✅ Created academic year: ${year}`);
        } catch (err) {
          // Ignore duplicate errors
        }
      }
    }
    
    // Get the current academic year (or most recent)
    const [currentAcademicYear] = await connection.query(
      'SELECT * FROM academic_years WHERE year_label = ? AND is_active = 1',
      [currentYear.toString()]
    );
    
    let defaultAcademicYearId;
    if (currentAcademicYear.length > 0) {
      defaultAcademicYearId = currentAcademicYear[0].id;
      console.log(`📅 Using current academic year: ${currentYear} (ID: ${defaultAcademicYearId})`);
    } else {
      // Use the most recent active academic year
      const [mostRecent] = await connection.query(
        'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label DESC LIMIT 1'
      );
      if (mostRecent.length > 0) {
        defaultAcademicYearId = mostRecent[0].id;
        console.log(`📅 Using most recent academic year: ${mostRecent[0].year_label} (ID: ${defaultAcademicYearId})`);
      }
    }
    
    if (!defaultAcademicYearId) {
      console.error('❌ Could not find or create an academic year to assign');
      return;
    }
    
    // Find branches without academic_year_id
    const [branchesWithoutYear] = await connection.query(`
      SELECT cb.id, cb.name, cb.course_id, c.name as course_name
      FROM course_branches cb
      LEFT JOIN courses c ON cb.course_id = c.id
      WHERE cb.academic_year_id IS NULL
    `);
    
    console.log(`\n📋 Found ${branchesWithoutYear.length} branch(es) without academic year assigned`);
    
    if (branchesWithoutYear.length === 0) {
      console.log('✅ All branches already have academic years assigned!');
      return;
    }
    
    // Update branches
    console.log('\n📦 Updating branches...');
    
    for (const branch of branchesWithoutYear) {
      await connection.query(
        'UPDATE course_branches SET academic_year_id = ? WHERE id = ?',
        [defaultAcademicYearId, branch.id]
      );
      console.log(`   ✅ Updated: ${branch.course_name} - ${branch.name}`);
    }
    
    console.log('\n🎉 Sync completed successfully!');
    console.log(`   - Updated ${branchesWithoutYear.length} branch(es)`);
    console.log(`   - Assigned to academic year: ${currentYear}`);
    
    // Show summary
    const [summary] = await connection.query(`
      SELECT 
        ay.year_label,
        COUNT(cb.id) as branch_count
      FROM academic_years ay
      LEFT JOIN course_branches cb ON cb.academic_year_id = ay.id
      WHERE ay.is_active = 1
      GROUP BY ay.id, ay.year_label
      ORDER BY ay.year_label DESC
    `);
    
    console.log('\n📊 Summary by Academic Year:');
    for (const row of summary) {
      console.log(`   ${row.year_label}: ${row.branch_count} branch(es)`);
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

syncBranchesWithAcademicYears().catch((error) => {
  console.error('Sync error:', error);
  process.exit(1);
});


