const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { masterPool } = require('../config/database');
require('dotenv').config();

/**
 * Complete login flow test for Teja's super admin account
 */
async function testCompleteLoginFlow() {
    try {
        console.log('🧪 Testing Complete Login Flow for Teja Super Admin...\n');
        console.log('═══════════════════════════════════════════════════════\n');

        const username = 'teja';
        const password = 'superadmin';

        // Step 1: Fetch user
        console.log('Step 1: Fetching user from database...');
        const [users] = await masterPool.query(
            `SELECT * FROM rbac_users WHERE username = ?`,
            [username]
        );

        if (!users || users.length === 0) {
            console.log('❌ FAILED: User not found\n');
            process.exit(1);
        }

        const user = users[0];
        console.log('✅ User found');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}\n`);

        // Step 2: Check if active
        console.log('Step 2: Checking account status...');
        if (!user.is_active) {
            console.log('❌ FAILED: Account is not active\n');
            process.exit(1);
        }
        console.log('✅ Account is active\n');

        // Step 3: Verify password
        console.log('Step 3: Verifying password...');
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log('❌ FAILED: Invalid password\n');
            process.exit(1);
        }
        console.log('✅ Password verified\n');

        // Step 4: Generate JWT token (simulated)
        console.log('Step 4: Generating JWT token...');
        const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

        const tokenPayload = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            name: user.name
        };

        const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '7d' });
        console.log('✅ JWT token generated');
        console.log(`   Token length: ${token.length} characters\n`);

        // Step 5: Parse permissions
        console.log('Step 5: Parsing permissions...');
        const permissions = typeof user.permissions === 'string'
            ? JSON.parse(user.permissions)
            : user.permissions;

        const moduleCount = Object.keys(permissions).length;
        console.log(`✅ Permissions parsed`);
        console.log(`   Total modules: ${moduleCount}\n`);

        // Step 6: Verify super admin permissions
        console.log('Step 6: Verifying super admin permissions...');
        let hasAllPermissions = true;
        let permissionDetails = [];

        for (const module in permissions) {
            const modulePerms = permissions[module];
            const permCount = Object.keys(modulePerms).length;
            const allTrue = Object.values(modulePerms).every(v => v === true);

            permissionDetails.push({
                module,
                permissions: permCount,
                allGranted: allTrue
            });

            if (!allTrue) {
                hasAllPermissions = false;
            }
        }

        if (hasAllPermissions) {
            console.log('✅ All permissions granted (Full Super Admin Access)');
        } else {
            console.log('✅ Granular permissions configured');
        }

        console.log('\n   Module breakdown:');
        permissionDetails.forEach(detail => {
            const status = detail.allGranted ? '✅' : '📋';
            console.log(`   ${status} ${detail.module}: ${detail.permissions} permissions`);
        });

        // Final Summary
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('🎉 LOGIN FLOW TEST COMPLETED SUCCESSFULLY!\n');
        console.log('📋 Summary:');
        console.log('   ✅ User authentication: PASSED');
        console.log('   ✅ Account status: ACTIVE');
        console.log('   ✅ Password verification: PASSED');
        console.log('   ✅ JWT generation: PASSED');
        console.log('   ✅ Permissions: CONFIGURED');
        console.log('\n🔐 Login Credentials:');
        console.log('   Username: teja');
        console.log('   Password: superadmin');
        console.log('   Email: teja@pydahsoft.in');
        console.log('   Phone: 7995207344');
        console.log('\n✅ The account is ready to use!');
        console.log('═══════════════════════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ LOGIN FLOW TEST FAILED!');
        console.error('Error:', error.message);
        console.error('\nFull error:', error);
        process.exit(1);
    }
}

testCompleteLoginFlow();
