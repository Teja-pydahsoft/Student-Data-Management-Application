/**
 * Script to sync existing branches with academic years
 * 
 * This script will:
 * 1. Find all branches that don't have an academic_year_id
 * 2. Assign them to the current or most recent academic year
 * 
 * Run with: node scripts/sync_branches_to_academic_years.js
 */

const { masterPool } = require('../config/database');

async function syncBranchesToAcademicYears() {
  console.log('🔄 Starting branch to academic year sync...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Get all active academic years
    const [academicYears] = await connection.query(
      'SELECT * FROM academic_years WHERE is_active = 1 ORDER BY year_label DESC'
    );

    if (academicYears.length === 0) {
      console.log('❌ No active academic years found. Please create academic years first.');
      console.log('   You can create them in Settings > Academic Years (Batches)');
      return;
    }

    console.log('📋 Available Academic Years:');
    academicYears.forEach((year, index) => {
      console.log(`   ${index + 1}. ${year.year_label} (ID: ${year.id})`);
    });
    console.log('');

    // Get the current year as default (or most recent if current year doesn't exist)
    const currentCalendarYear = new Date().getFullYear();
    let defaultYear = academicYears.find(y => y.year_label === currentCalendarYear.toString());
    if (!defaultYear) {
      defaultYear = academicYears[0]; // Use the most recent
    }

    console.log(`📌 Default academic year to use: ${defaultYear.year_label} (ID: ${defaultYear.id})\n`);

    // Find branches without academic year
    const [branchesWithoutYear] = await connection.query(`
      SELECT cb.id, cb.name, cb.course_id, c.name as course_name
      FROM course_branches cb
      LEFT JOIN courses c ON cb.course_id = c.id
      WHERE cb.academic_year_id IS NULL
    `);

    if (branchesWithoutYear.length === 0) {
      console.log('✅ All branches already have academic years assigned!');
      return;
    }

    console.log(`📦 Found ${branchesWithoutYear.length} branch(es) without academic year:\n`);
    branchesWithoutYear.forEach(branch => {
      console.log(`   - ${branch.name} (Course: ${branch.course_name || 'Unknown'})`);
    });
    console.log('');

    // Update branches to assign the default academic year
    const [updateResult] = await connection.query(`
      UPDATE course_branches 
      SET academic_year_id = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE academic_year_id IS NULL
    `, [defaultYear.id]);

    console.log(`✅ Updated ${updateResult.affectedRows} branch(es) with academic year: ${defaultYear.year_label}`);
    console.log('');

    // Show updated branches
    const [updatedBranches] = await connection.query(`
      SELECT cb.id, cb.name, cb.course_id, c.name as course_name, ay.year_label
      FROM course_branches cb
      LEFT JOIN courses c ON cb.course_id = c.id
      LEFT JOIN academic_years ay ON cb.academic_year_id = ay.id
      WHERE cb.academic_year_id = ?
    `, [defaultYear.id]);

    console.log('📋 Branches now assigned to ' + defaultYear.year_label + ':');
    updatedBranches.forEach(branch => {
      console.log(`   - ${branch.name} (Course: ${branch.course_name || 'Unknown'})`);
    });

    console.log('\n🎉 Sync completed successfully!');
    console.log('\n💡 Tip: You can change individual branch academic years in:');
    console.log('   Settings > Select College > Select Course > Edit Branch');

  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

syncBranchesToAcademicYears().catch((error) => {
  console.error('Sync error:', error);
  process.exit(1);
});

