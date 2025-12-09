/**
 * Script to verify and fix the branch code constraint
 * This ensures the old constraint is dropped and new one is created
 */

const { masterPool } = require('../config/database');

async function verifyAndFixConstraint() {
  console.log('🔍 Verifying branch code constraint...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Check current constraints
    const [constraints] = await connection.query(`
      SELECT CONSTRAINT_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) as columns
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'course_branches'
        AND CONSTRAINT_NAME LIKE '%branch_code%'
      GROUP BY CONSTRAINT_NAME
    `);

    console.log('Current branch code constraints:');
    if (constraints.length === 0) {
      console.log('   ⚠️  No branch code constraints found');
    } else {
      constraints.forEach(c => {
        console.log(`   - ${c.CONSTRAINT_NAME}: (${c.columns})`);
      });
    }

    // Check if old constraint exists
    const oldConstraint = constraints.find(c => c.CONSTRAINT_NAME === 'unique_branch_code_per_course');
    const newConstraint = constraints.find(c => c.CONSTRAINT_NAME === 'unique_branch_code_per_course_year');

    if (oldConstraint && !newConstraint) {
      console.log('\n❌ Old constraint exists but new one does not. Fixing...');
      
      // Drop old constraint
      try {
        await connection.query(`
          ALTER TABLE course_branches DROP INDEX unique_branch_code_per_course
        `);
        console.log('   ✅ Dropped old constraint');
      } catch (err) {
        console.log('   ⚠️  Could not drop old constraint:', err.message);
      }

      // Create new constraint
      try {
        await connection.query(`
          ALTER TABLE course_branches 
          ADD UNIQUE KEY unique_branch_code_per_course_year (course_id, code, academic_year_id)
        `);
        console.log('   ✅ Created new constraint');
      } catch (err) {
        console.log('   ⚠️  Could not create new constraint:', err.message);
      }
    } else if (oldConstraint && newConstraint) {
      console.log('\n⚠️  Both old and new constraints exist. Dropping old one...');
      try {
        await connection.query(`
          ALTER TABLE course_branches DROP INDEX unique_branch_code_per_course
        `);
        console.log('   ✅ Dropped old constraint');
      } catch (err) {
        console.log('   ⚠️  Could not drop old constraint:', err.message);
      }
    } else if (!oldConstraint && newConstraint) {
      console.log('\n✅ Constraint is correctly configured');
    } else {
      console.log('\n⚠️  Neither constraint exists. Creating new one...');
      try {
        await connection.query(`
          ALTER TABLE course_branches 
          ADD UNIQUE KEY unique_branch_code_per_course_year (course_id, code, academic_year_id)
        `);
        console.log('   ✅ Created new constraint');
      } catch (err) {
        console.log('   ⚠️  Could not create new constraint:', err.message);
      }
    }

    // Verify final state
    const [finalConstraints] = await connection.query(`
      SELECT CONSTRAINT_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) as columns
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'course_branches'
        AND CONSTRAINT_NAME LIKE '%branch_code%'
      GROUP BY CONSTRAINT_NAME
    `);

    console.log('\nFinal constraint state:');
    if (finalConstraints.length === 0) {
      console.log('   ⚠️  No branch code constraints found');
    } else {
      finalConstraints.forEach(c => {
        console.log(`   - ${c.CONSTRAINT_NAME}: (${c.columns})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the verification
if (require.main === module) {
  verifyAndFixConstraint()
    .then(() => {
      console.log('\n🎉 Verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyAndFixConstraint };

