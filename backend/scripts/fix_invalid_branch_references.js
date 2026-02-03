/**
 * Script to fix invalid branch references in rbac_users after branch consolidation
 * This identifies and fixes users with branch_id or branch_ids pointing to non-existent branches
 */

const { masterPool } = require('../config/database');

async function fixInvalidBranchReferences() {
  console.log('🔍 Checking for invalid branch references in rbac_users...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Get all users with branch references
    const [users] = await connection.query(`
      SELECT 
        id,
        name,
        email,
        branch_id,
        branch_ids
      FROM rbac_users
      WHERE branch_id IS NOT NULL 
         OR (branch_ids IS NOT NULL AND branch_ids != '[]' AND branch_ids != 'null')
    `);
    
    console.log(`Found ${users.length} users with branch references\n`);
    
    let fixedCount = 0;
    let invalidCount = 0;
    
    for (const user of users) {
      let hasInvalid = false;
      let validBranchIds = [];
      
      // Check single branch_id
      if (user.branch_id) {
        const [branchCheck] = await connection.query(
          'SELECT id FROM course_branches WHERE id = ? AND is_active = 1',
          [user.branch_id]
        );
        
        if (branchCheck.length > 0) {
          validBranchIds.push(user.branch_id);
        } else {
          hasInvalid = true;
          console.log(`   ⚠️  User ${user.id} (${user.name || user.email}): branch_id ${user.branch_id} does not exist`);
        }
      }
      
      // Check branch_ids array
      if (user.branch_ids) {
        try {
          let branchIds = [];
          if (typeof user.branch_ids === 'string') {
            branchIds = JSON.parse(user.branch_ids);
          } else {
            branchIds = user.branch_ids;
          }
          
          if (Array.isArray(branchIds) && branchIds.length > 0) {
            // Check each branch ID
            for (const branchId of branchIds) {
              if (branchId == null || isNaN(Number(branchId))) {
                hasInvalid = true;
                console.log(`   ⚠️  User ${user.id} (${user.name || user.email}): Invalid branch_id in array: ${branchId}`);
                continue;
              }
              
              const [branchCheck] = await connection.query(
                'SELECT id FROM course_branches WHERE id = ? AND is_active = 1',
                [Number(branchId)]
              );
              
              if (branchCheck.length > 0) {
                if (!validBranchIds.includes(Number(branchId))) {
                  validBranchIds.push(Number(branchId));
                }
              } else {
                hasInvalid = true;
                console.log(`   ⚠️  User ${user.id} (${user.name || user.email}): branch_id ${branchId} in array does not exist`);
              }
            }
          }
        } catch (error) {
          hasInvalid = true;
          console.log(`   ⚠️  User ${user.id} (${user.name || user.email}): Cannot parse branch_ids JSON: ${error.message}`);
          console.log(`      branch_ids value: ${user.branch_ids}`);
        }
      }
      
      // Fix invalid references
      if (hasInvalid) {
        invalidCount++;
        
        // Remove duplicates
        validBranchIds = [...new Set(validBranchIds)];
        
        try {
          await connection.query('BEGIN');
          
          // Update branch_id (use first valid ID or NULL)
          const newBranchId = validBranchIds.length > 0 ? validBranchIds[0] : null;
          await connection.query(
            'UPDATE rbac_users SET branch_id = ? WHERE id = ?',
            [newBranchId, user.id]
          );
          
          // Update branch_ids array
          const newBranchIdsJson = JSON.stringify(validBranchIds);
          await connection.query(
            'UPDATE rbac_users SET branch_ids = CAST(? AS JSON) WHERE id = ?',
            [newBranchIdsJson, user.id]
          );
          
          await connection.query('COMMIT');
          
          fixedCount++;
          console.log(`   ✅ Fixed user ${user.id}: Updated to branch_ids: ${newBranchIdsJson}`);
        } catch (error) {
          await connection.query('ROLLBACK');
          console.log(`   ❌ Failed to fix user ${user.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ Summary:`);
    console.log(`   Total users checked: ${users.length}`);
    console.log(`   Users with invalid references: ${invalidCount}`);
    console.log(`   Users fixed: ${fixedCount}`);
    
  } catch (error) {
    console.error('❌ Error fixing branch references:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  fixInvalidBranchReferences()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixInvalidBranchReferences };
