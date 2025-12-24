const { masterPool } = require('../config/database');

async function checkSuperAdmins() {
    try {
        const [rows] = await masterPool.query(
            "SELECT id, name, email, role FROM rbac_users WHERE role IN ('admin', 'super_admin')"
        );
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSuperAdmins();
