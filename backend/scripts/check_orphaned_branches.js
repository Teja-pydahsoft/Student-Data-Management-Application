/**
 * Script to check for orphaned branches (branches without a valid course)
 * Run with: node scripts/check_orphaned_branches.js
 */

const { masterPool } = require('../config/database');

async function checkOrphanedBranches() {
  console.log('🔍 Checking for orphaned branches...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Check for branches with invalid course_id
    const [orphanedBranches] = await connection.query(`
      SELECT cb.id, cb.course_id, cb.name, cb.code, cb.academic_year_id, c.name as course_name
      FROM course_branches cb
      LEFT JOIN courses c ON cb.course_id = c.id
      WHERE c.id IS NULL
    `);

    if (orphanedBranches.length > 0) {
      console.log(`❌ Found ${orphanedBranches.length} orphaned branch(es):\n`);
      orphanedBranches.forEach(branch => {
        console.log(`   - ID: ${branch.id}, Name: ${branch.name}, Code: ${branch.code}, Course ID: ${branch.course_id}`);
      });
      console.log('\n⚠️  These branches should be deleted.');
      return orphanedBranches;
    } else {
      console.log('✅ No orphaned branches found.');
    }

    // Check for branches with NULL academic_year_id
    const [branchesWithoutYear] = await connection.query(`
      SELECT cb.id, cb.course_id, cb.name, cb.code, c.name as course_name
      FROM course_branches cb
      JOIN courses c ON cb.course_id = c.id
      WHERE cb.academic_year_id IS NULL
    `);

    if (branchesWithoutYear.length > 0) {
      console.log(`\n⚠️  Found ${branchesWithoutYear.length} branch(es) without academic_year_id:\n`);
      branchesWithoutYear.forEach(branch => {
        console.log(`   - ID: ${branch.id}, Name: ${branch.name}, Code: ${branch.code}, Course: ${branch.course_name}`);
      });
    } else {
      console.log('\n✅ All branches have academic_year_id assigned.');
    }

    // Check for duplicate branch codes within same course and year
    const [duplicates] = await connection.query(`
      SELECT course_id, code, academic_year_id, COUNT(*) as count
      FROM course_branches
      WHERE code IS NOT NULL
      GROUP BY course_id, code, academic_year_id
      HAVING count > 1
    `);

    if (duplicates.length > 0) {
      console.log(`\n❌ Found ${duplicates.length} duplicate branch code(s) within same course and year:\n`);
      duplicates.forEach(dup => {
        console.log(`   - Course ID: ${dup.course_id}, Code: ${dup.code}, Year ID: ${dup.academic_year_id}, Count: ${dup.count}`);
      });
    } else {
      console.log('\n✅ No duplicate branch codes found.');
    }

    // Check constraint status
    console.log('\n📋 Checking database constraints...');
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'course_branches'
        AND CONSTRAINT_NAME LIKE '%branch_code%'
      ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION
    `);

    if (constraints.length > 0) {
      console.log('\nBranch code constraints:');
      const constraintGroups = {};
      constraints.forEach(constraint => {
        if (!constraintGroups[constraint.CONSTRAINT_NAME]) {
          constraintGroups[constraint.CONSTRAINT_NAME] = [];
        }
        constraintGroups[constraint.CONSTRAINT_NAME].push(constraint.COLUMN_NAME);
      });
      
      Object.entries(constraintGroups).forEach(([name, columns]) => {
        console.log(`   - ${name}: (${columns.join(', ')})`);
      });
    }

    return {
      orphaned: orphanedBranches,
      withoutYear: branchesWithoutYear,
      duplicates: duplicates
    };
    
  } catch (error) {
    console.error('\n❌ Error checking branches:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the check
if (require.main === module) {
  checkOrphanedBranches()
    .then((result) => {
      if (result && result.orphaned && result.orphaned.length > 0) {
        console.log('\n💡 To clean up orphaned branches, you can run:');
        console.log('   DELETE FROM course_branches WHERE course_id NOT IN (SELECT id FROM courses);');
        process.exit(1);
      } else {
        console.log('\n🎉 Check completed');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('\n💥 Check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkOrphanedBranches };

