const { masterPool } = require('../config/database');

async function verifyTejaSuperAdmin() {
    try {
        console.log('🔍 Verifying Teja Super Admin user...\n');

        const [rows] = await masterPool.query(
            `SELECT id, name, email, phone, username, role, is_active, created_at 
             FROM rbac_users 
             WHERE email = ? OR username = ?`,
            ['teja@pydahsoft.in', 'teja']
        );

        if (rows && rows.length > 0) {
            console.log('✅ Teja Super Admin found in database:\n');
            console.log(JSON.stringify(rows[0], null, 2));
            console.log('\n📋 Summary:');
            console.log(`   ID: ${rows[0].id}`);
            console.log(`   Name: ${rows[0].name}`);
            console.log(`   Email: ${rows[0].email}`);
            console.log(`   Phone: ${rows[0].phone}`);
            console.log(`   Username: ${rows[0].username}`);
            console.log(`   Role: ${rows[0].role}`);
            console.log(`   Active: ${rows[0].is_active ? 'Yes' : 'No'}`);
            console.log(`   Created: ${rows[0].created_at}`);
        } else {
            console.log('❌ Teja Super Admin not found in database');
        }

        console.log('\n📊 All Super Admins in system:');
        const [allAdmins] = await masterPool.query(
            `SELECT id, name, email, phone, username, role 
             FROM rbac_users 
             WHERE role = 'super_admin'
             ORDER BY id`
        );
        console.log(JSON.stringify(allAdmins, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

verifyTejaSuperAdmin();
