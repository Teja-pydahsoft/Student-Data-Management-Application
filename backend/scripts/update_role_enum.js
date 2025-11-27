const { masterPool } = require('../config/database');

async function updateRoleEnum() {
  try {
    console.log('Updating role ENUM column...');
    
    await masterPool.query(`
      ALTER TABLE rbac_users 
      MODIFY COLUMN role ENUM(
        'super_admin', 
        'college_principal', 
        'college_ao', 
        'college_attender', 
        'branch_hod',
        'campus_principal',
        'campus_ao', 
        'course_principal', 
        'course_ao', 
        'hod', 
        'attender'
      ) NOT NULL
    `);
    
    console.log('✅ Database role column updated successfully!');
    console.log('New roles available: college_principal, college_ao, college_attender, branch_hod');
  } catch (error) {
    console.error('❌ Error updating role column:', error.message);
  } finally {
    process.exit();
  }
}

updateRoleEnum();

