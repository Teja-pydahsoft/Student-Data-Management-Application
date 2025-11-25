const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');
const { supabase } = require('../config/supabase');
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

    // Fetch existing admin from Supabase admins table
    let adminAccount = null;

    if (supabase) {
      try {
        console.log('🔍 Checking Supabase for existing admin...');
        // First try to find superadmin
        let { data: admins, error } = await supabase
          .from('admins')
          .select('*')
          .eq('username', 'superadmin')
          .limit(1);

        if (error) {
          console.error('⚠️  Error fetching from Supabase:', error.message);
          console.error('   Error details:', error);
        } else if (admins && admins.length > 0) {
          adminAccount = admins[0];
          console.log('✅ Found admin in Supabase with username "superadmin"');
        } else {
          console.log('ℹ️  No admin found in Supabase with username "superadmin"');
          // Try to find admin with username "admin"
          const { data: adminUsers } = await supabase
            .from('admins')
            .select('*')
            .eq('username', 'admin')
            .limit(1);
          
          if (adminUsers && adminUsers.length > 0) {
            adminAccount = adminUsers[0];
            console.log('✅ Found admin in Supabase with username "admin"');
            console.log('   Will migrate and rename to "superadmin"');
          } else {
            // Try to find any admin
            const { data: allAdmins } = await supabase
              .from('admins')
              .select('*')
              .limit(5);
            
            if (allAdmins && allAdmins.length > 0) {
              console.log(`   Found ${allAdmins.length} admin(s) in Supabase:`);
              allAdmins.forEach(admin => {
                console.log(`     - ID: ${admin.id}, Username: ${admin.username}, Email: ${admin.email}`);
              });
              // Use the first admin found
              adminAccount = allAdmins[0];
              console.log(`   Using first admin: ${adminAccount.username}`);
            }
          }
        }
      } catch (error) {
        console.error('⚠️  Supabase lookup failed:', error.message);
        console.error('   This might mean Supabase is not configured or not accessible');
      }
    } else {
      console.log('ℹ️  Supabase not configured, skipping Supabase lookup');
    }

    // If not found in Supabase, try MySQL admins table
    if (!adminAccount) {
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
          }
        }
      } catch (error) {
        console.error('⚠️  MySQL admins table lookup failed:', error.message);
      }
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

