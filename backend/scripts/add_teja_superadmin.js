const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');
const { createSuperAdminPermissions } = require('../constants/rbac');
require('dotenv').config();

/**
 * Script to add Teja as a Super Admin user
 * Username: teja
 * Email: teja@pydahsoft.in
 * Password: superadmin
 * Contact: 7995207344
 */
async function addTejaSuperAdmin() {
    try {
        console.log('🔄 Creating Teja Super Admin user...\n');

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

        // Check if user with this email or username already exists
        const [existingByEmail] = await masterPool.query(
            'SELECT id, email FROM rbac_users WHERE email = ? LIMIT 1',
            ['teja@pydahsoft.in']
        );

        if (existingByEmail && existingByEmail.length > 0) {
            console.log('⚠️  User with email teja@pydahsoft.in already exists.');
            console.log(`   User ID: ${existingByEmail[0].id}\n`);
            return;
        }

        const [existingByUsername] = await masterPool.query(
            'SELECT id, username FROM rbac_users WHERE username = ? LIMIT 1',
            ['teja']
        );

        if (existingByUsername && existingByUsername.length > 0) {
            console.log('⚠️  User with username "teja" already exists.');
            console.log(`   User ID: ${existingByUsername[0].id}\n`);
            return;
        }

        // User details
        const name = 'Teja';
        const email = 'teja@pydahsoft.in';
        const username = 'teja';
        const password = 'superadmin';
        const phone = '7995207344';

        console.log(`Creating Super Admin:`);
        console.log(`  Name: ${name}`);
        console.log(`  Email: ${email}`);
        console.log(`  Username: ${username}`);
        console.log(`  Password: ${password}`);
        console.log(`  Phone: ${phone}\n`);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create permissions
        const permissions = createSuperAdminPermissions();

        // Insert super admin
        const [result] = await masterPool.query(
            `
        INSERT INTO rbac_users 
          (name, email, phone, username, password, role, permissions, created_by)
        VALUES (?, ?, ?, ?, ?, 'super_admin', CAST(? AS JSON), NULL)
      `,
            [
                name,
                email,
                phone,
                username,
                hashedPassword,
                JSON.stringify(permissions)
            ]
        );

        console.log('✅ Teja Super Admin created successfully!');
        console.log(`   User ID: ${result.insertId}`);
        console.log(`   Username: ${username}`);
        console.log(`   Email: ${email}`);
        console.log(`   Phone: ${phone}`);
        console.log(`   Password: ${password}\n`);
        console.log('⚠️  Please change the password after first login!\n');

    } catch (error) {
        console.error('❌ Failed to create Teja Super Admin:', error.message);
        if (error.code === 'ER_DUP_ENTRY') {
            console.error('   Email or username already exists');
        }
        console.error('   Full error:', error);
        process.exit(1);
    }
}

// Run script
addTejaSuperAdmin().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
