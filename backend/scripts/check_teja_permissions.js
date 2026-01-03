const { masterPool } = require('../config/database');

async function checkPermissions() {
    try {
        const [users] = await masterPool.query(
            `SELECT id, name, username, role, permissions 
             FROM rbac_users 
             WHERE username = ?`,
            ['teja']
        );

        if (users && users.length > 0) {
            const user = users[0];
            const permissions = typeof user.permissions === 'string'
                ? JSON.parse(user.permissions)
                : user.permissions;

            console.log('📋 Teja\'s Permissions:\n');
            console.log(JSON.stringify(permissions, null, 2));

            console.log('\n🔍 Detailed Permission Analysis:');
            for (const module in permissions) {
                const read = permissions[module].read;
                const write = permissions[module].write;
                const status = (read && write) ? '✅' : '⚠️';
                console.log(`${status} ${module}: read=${read}, write=${write}`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkPermissions();
