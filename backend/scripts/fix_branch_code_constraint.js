/**
 * Script to fix the unique_branch_code_per_course constraint
 * Updates it to include academic_year_id so same branch code can exist for different years
 * 
 * Run with: node scripts/fix_branch_code_constraint.js
 */

const { masterPool } = require('../config/database');

async function fixBranchCodeConstraint() {
  console.log('🔄 Fixing unique_branch_code_per_course constraint...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Step 1: Check if academic_year_id column exists
    console.log('📦 Step 1: Checking academic_year_id column...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'course_branches' 
        AND COLUMN_NAME = 'academic_year_id'
    `);

    if (columns.length === 0) {
      console.log('   ❌ academic_year_id column does not exist. Please run the academic years migration first.');
      return;
    }
    console.log('   ✅ academic_year_id column exists');

    // Step 2: Drop the old unique constraint on branch code
    console.log('\n📦 Step 2: Dropping old unique_branch_code_per_course constraint...');
    try {
      await connection.query(`
        ALTER TABLE course_branches DROP INDEX unique_branch_code_per_course
      `);
      console.log('   ✅ Dropped old unique_branch_code_per_course constraint');
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('   ⚠️  Constraint may not exist or already dropped');
      } else {
        throw err;
      }
    }

    // Step 3: Create new unique constraint that includes academic_year_id
    console.log('\n📦 Step 3: Creating new unique_branch_code_per_course_year constraint...');
    try {
      await connection.query(`
        ALTER TABLE course_branches 
        ADD UNIQUE KEY unique_branch_code_per_course_year (course_id, code, academic_year_id)
      `);
      console.log('   ✅ Created new unique constraint (course_id, code, academic_year_id)');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('   ⚠️  Constraint unique_branch_code_per_course_year already exists');
      } else {
        throw err;
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('   The same branch code can now exist for different academic years.');
    console.log('   Duplicates within the same course and year are still prevented.');
    
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the migration
if (require.main === module) {
  fixBranchCodeConstraint()
    .then(() => {
      console.log('\n🎉 Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixBranchCodeConstraint };

