/**
 * Script to clean up orphaned branches (branches without valid course_id)
 * and branches with NULL academic_year_id that might cause conflicts
 * 
 * Run with: node scripts/cleanup_orphaned_branches.js
 */

const { masterPool } = require('../config/database');

async function cleanupOrphanedBranches() {
  console.log('🧹 Cleaning up orphaned branches...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Step 1: Delete branches with invalid course_id
    console.log('📦 Step 1: Deleting branches with invalid course_id...');
    const [deleteResult] = await connection.query(`
      DELETE cb FROM course_branches cb
      LEFT JOIN courses c ON cb.course_id = c.id
      WHERE c.id IS NULL
    `);
    console.log(`   ✅ Deleted ${deleteResult.affectedRows} orphaned branch(es)`);

    // Step 2: Check for branches with NULL academic_year_id that might conflict
    console.log('\n📦 Step 2: Checking branches with NULL academic_year_id...');
    const [nullYearBranches] = await connection.query(`
      SELECT cb.id, cb.course_id, cb.name, cb.code, c.name as course_name
      FROM course_branches cb
      JOIN courses c ON cb.course_id = c.id
      WHERE cb.academic_year_id IS NULL
      ORDER BY cb.course_id, cb.code
    `);

    if (nullYearBranches.length > 0) {
      console.log(`   Found ${nullYearBranches.length} branch(es) with NULL academic_year_id`);
      console.log('   ⚠️  These branches might cause conflicts when creating new branches.');
      console.log('   💡 Consider assigning academic_year_id to these branches or deleting them if they are duplicates.');
      
      // Group by course_id and code to find potential duplicates
      const duplicates = {};
      nullYearBranches.forEach(branch => {
        const key = `${branch.course_id}-${branch.code || branch.name}`;
        if (!duplicates[key]) {
          duplicates[key] = [];
        }
        duplicates[key].push(branch);
      });

      const duplicateKeys = Object.keys(duplicates).filter(key => duplicates[key].length > 1);
      if (duplicateKeys.length > 0) {
        console.log(`\n   ⚠️  Found ${duplicateKeys.length} potential duplicate group(s):`);
        duplicateKeys.forEach(key => {
          console.log(`      - ${key}: ${duplicates[key].length} branch(es)`);
        });
      }
    } else {
      console.log('   ✅ No branches with NULL academic_year_id found');
    }

    await connection.commit();
    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupOrphanedBranches()
    .then(() => {
      console.log('\n🎉 Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOrphanedBranches };

