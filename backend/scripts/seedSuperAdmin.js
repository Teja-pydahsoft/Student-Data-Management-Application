const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');
const { createSuperAdminPermissions } = require('../constants/rbac');
require('dotenv').config();

/**
 * Seed script to create the first Super Admin user
 * Usage: node scripts/seedSuperAdmin.js
 */
async function seedSuperAdmin() {
  try {
    console.log('🔄 Creating Super Admin user...\n');

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
    const [existing] = await masterPool.query(
      'SELECT id FROM rbac_users WHERE role = ? LIMIT 1',
      ['super_admin']
    );

    if (existing && existing.length > 0) {
      console.log('⚠️  Super Admin already exists in RBAC system.');
      console.log('   If you need to migrate an existing admin, run: node scripts/migrateExistingAdminToRBAC.js\n');
      return;
    }

    // Check if existing admin exists in admins table
    const { supabase } = require('../config/supabase');
    let existingAdmin = null;

    if (supabase) {
      try {
        const { data: admins } = await supabase
          .from('admins')
          .select('*')
          .eq('username', 'superadmin')
          .limit(1);
        
        if (admins && admins.length > 0) {
          existingAdmin = admins[0];
        }
      } catch (error) {
        // Ignore Supabase errors
      }
    }

    if (existingAdmin) {
      console.log('⚠️  Found existing admin in admins table.');
      console.log('   To migrate existing admin to RBAC, run: node scripts/migrateExistingAdminToRBAC.js');
      console.log('   Or continue to create a new super admin below.\n');
    }

    // Get admin details from environment or use defaults
    const name = process.env.SUPER_ADMIN_NAME || 'Super Admin';
    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@pydah.edu';
    const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin@123';

    console.log(`Creating Super Admin:`);
    console.log(`  Name: ${name}`);
    console.log(`  Email: ${email}`);
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}\n`);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create permissions
    const permissions = createSuperAdminPermissions();

    // Insert super admin
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
        hashedPassword,
        JSON.stringify(permissions)
      ]
    );

    console.log('✅ Super Admin created successfully!');
    console.log(`   User ID: ${result.insertId}`);
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password}\n`);
    console.log('⚠️  Please change the password after first login!\n');

  } catch (error) {
    console.error('❌ Failed to create Super Admin:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   Email or username already exists');
    }
    process.exit(1);
  }
}

// Run seed
seedSuperAdmin().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

