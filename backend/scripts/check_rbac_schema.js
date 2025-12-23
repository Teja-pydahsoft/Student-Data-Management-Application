const { masterPool } = require('../config/database');

async function checkSchema() {
    try {
        const [columns] = await masterPool.query('DESCRIBE rbac_users');
        console.log('Columns in rbac_users:', columns.map(c => c.Field));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkSchema();
