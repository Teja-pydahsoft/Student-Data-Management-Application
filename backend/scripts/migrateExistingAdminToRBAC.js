const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');
const { createSuperAdminPermissions } = require('../constants/rbac');
require('dotenv').config();

/**
 * Migrate existing admin from admins table to rbac_users table
 * This script checks for existing admins and creates corresponding super_admin in rbac_users
 */
async function migrateExistingAdminToRBAC() {
  try {
    console.log('🔄 Migrating existing admin to RBAC system...\n');

    // Check if rbac_users table exists
    const [tableCheck] = await masterPool.query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = DATABASE() AND table_name = 'rbac_users'`
    );

    if (!tableCheck || tableCheck.length === 0 || tableCheck[0].count === 0) {
      console.log('❌ rbac_users table does not exist. Please run migration first.');
      console.log('   Run: node scripts/run_rbac_migration.js\n');
      process.exit(1);
    }

    // Check if super admin already exists in rbac_users
    const [existingRBAC] = await masterPool.query(
      'SELECT id FROM rbac_users WHERE role = ? LIMIT 1',
      ['super_admin']
    );

    if (existingRBAC && existingRBAC.length > 0) {
      console.log('✅ Super Admin already exists in RBAC system. Skipping migration.\n');
      return;
    }

    // Fetch existing admin from MySQL admins table
    let adminAccount = null;

    try {
      console.log('🔍 Checking MySQL for existing admin...');
      // First try superadmin
      let [mysqlAdmins] = await masterPool.query(
        'SELECT * FROM admins WHERE username = ? LIMIT 1',
        ['superadmin']
      );

      if (mysqlAdmins && mysqlAdmins.length > 0) {
        adminAccount = mysqlAdmins[0];
        console.log('✅ Found admin in MySQL with username "superadmin"');
      } else {
        // Try admin
        [mysqlAdmins] = await masterPool.query(
          'SELECT * FROM admins WHERE username = ? LIMIT 1',
          ['admin']
        );

        if (mysqlAdmins && mysqlAdmins.length > 0) {
          adminAccount = mysqlAdmins[0];
          console.log('✅ Found admin in MySQL with username "admin"');
          console.log('   Will migrate and rename to "superadmin"');
        } else {
          // Try to find any admin
          [mysqlAdmins] = await masterPool.query(
            'SELECT * FROM admins LIMIT 5'
          );
          
          if (mysqlAdmins && mysqlAdmins.length > 0) {
            console.log(`   Found ${mysqlAdmins.length} admin(s) in MySQL:`);
            mysqlAdmins.forEach(admin => {
              console.log(`     - ID: ${admin.id}, Username: ${admin.username}, Email: ${admin.email}`);
            });
            // Use the first admin found
            adminAccount = mysqlAdmins[0];
            console.log(`   Using first admin: ${adminAccount.username}`);
          }
        }
      }
    } catch (error) {
      console.error('⚠️  MySQL admins table lookup failed:', error.message);
    }

    if (!adminAccount) {
      console.log('⚠️  No existing admin found with username "superadmin"');
      console.log('   You can create a new super admin using: node scripts/seedSuperAdmin.js\n');
      return;
    }

    console.log(`Found existing admin:`);
    console.log(`  ID: ${adminAccount.id}`);
    console.log(`  Username: ${adminAccount.username}`);
    console.log(`  Email: ${adminAccount.email || 'N/A'}\n`);

    // Create super admin in rbac_users
    const name = 'Super Admin';
    const email = adminAccount.email || 'admin@example.com';
    // Always use 'superadmin' as username for RBAC, regardless of original username
    const username = 'superadmin';
    const password = adminAccount.password; // Use existing password hash
    const permissions = createSuperAdminPermissions();

    // Insert into rbac_users
    const [result] = await masterPool.query(
      `
        INSERT INTO rbac_users 
          (name, email, username, password, role, permissions, created_by)
        VALUES (?, ?, ?, ?, 'super_admin', CAST(? AS JSON), NULL)
      `,
      [
        name,
        email,
        username,
        password,
        JSON.stringify(permissions)
      ]
    );

    console.log('✅ Successfully migrated admin to RBAC system!');
    console.log(`   User ID: ${result.insertId}`);
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: super_admin`);
    console.log(`   Permissions: Full access to all modules\n`);
    console.log('📝 You can now login with the existing credentials.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   User already exists in rbac_users table');
    }
    console.error('Error details:', error);
    process.exit(1);
  }
}

// Run migration
migrateExistingAdminToRBAC().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

