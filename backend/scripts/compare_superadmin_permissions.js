const { masterPool } = require('../config/database');

async function comparePermissions() {
    try {
        console.log('🔍 Comparing Super Admin Permissions...\n');

        // Get both super admins
        const [users] = await masterPool.query(
            `SELECT id, name, username, role, permissions 
             FROM rbac_users 
             WHERE role = 'super_admin'
             ORDER BY id`
        );

        if (users && users.length >= 2) {
            const user1 = users[0];
            const user2 = users[1];

            const perms1 = typeof user1.permissions === 'string'
                ? JSON.parse(user1.permissions)
                : user1.permissions;

            const perms2 = typeof user2.permissions === 'string'
                ? JSON.parse(user2.permissions)
                : user2.permissions;

            console.log(`📋 ${user1.name} (${user1.username}) Permissions:`);
            console.log(`   Modules: ${Object.keys(perms1).length}`);
            console.log(`   Structure: ${JSON.stringify(perms1, null, 2).substring(0, 200)}...\n`);

            console.log(`📋 ${user2.name} (${user2.username}) Permissions:`);
            console.log(`   Modules: ${Object.keys(perms2).length}`);
            console.log(`   Structure: ${JSON.stringify(perms2, null, 2).substring(0, 200)}...\n`);

            // Check if they're identical
            const perms1Str = JSON.stringify(perms1);
            const perms2Str = JSON.stringify(perms2);

            if (perms1Str === perms2Str) {
                console.log('✅ Permissions are IDENTICAL - Both users have the same super admin permissions!\n');
            } else {
                console.log('⚠️  Permissions are DIFFERENT\n');
                console.log('Modules in user1 but not in user2:',
                    Object.keys(perms1).filter(k => !perms2[k]));
                console.log('Modules in user2 but not in user1:',
                    Object.keys(perms2).filter(k => !perms1[k]));
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

comparePermissions();
