const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');

/**
 * Test script to verify Teja's super admin credentials
 */
async function testTejaLogin() {
    try {
        console.log('🧪 Testing Teja Super Admin login credentials...\n');

        const username = 'teja';
        const password = 'superadmin';

        // Fetch user from database
        const [users] = await masterPool.query(
            `SELECT id, name, email, phone, username, password, role, permissions, is_active 
             FROM rbac_users 
             WHERE username = ?`,
            [username]
        );

        if (!users || users.length === 0) {
            console.log('❌ User not found with username:', username);
            process.exit(1);
        }

        const user = users[0];
        console.log('✅ User found in database:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}\n`);

        // Check if account is active
        if (!user.is_active) {
            console.log('❌ Account is not active');
            process.exit(1);
        }

        // Verify password
        console.log('🔐 Verifying password...');
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (isPasswordValid) {
            console.log('✅ Password is correct!\n');
            console.log('📋 Login Credentials Summary:');
            console.log('   ═══════════════════════════════════════');
            console.log(`   Username: ${username}`);
            console.log(`   Password: ${password}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Phone: ${user.phone}`);
            console.log(`   Role: ${user.role}`);
            console.log('   ═══════════════════════════════════════\n');
            console.log('✅ All credentials verified successfully!');
            console.log('   You can now login with these credentials.\n');
        } else {
            console.log('❌ Password is incorrect!');
            console.log('   Expected: superadmin');
            process.exit(1);
        }

        // Check permissions
        if (user.permissions) {
            const permissions = typeof user.permissions === 'string'
                ? JSON.parse(user.permissions)
                : user.permissions;

            console.log('🔑 Permissions check:');
            const moduleCount = Object.keys(permissions).length;
            console.log(`   Total modules: ${moduleCount}`);

            // Check if all permissions are true (super admin should have all)
            let allTrue = true;
            for (const module in permissions) {
                if (permissions[module].read !== true || permissions[module].write !== true) {
                    allTrue = false;
                    break;
                }
            }

            if (allTrue) {
                console.log('   ✅ All permissions granted (Super Admin)\n');
            } else {
                console.log('   ⚠️  Some permissions are restricted\n');
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during test:', error);
        process.exit(1);
    }
}

testTejaLogin();
