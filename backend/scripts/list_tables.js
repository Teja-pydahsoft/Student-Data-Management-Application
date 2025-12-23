const { masterPool } = require('../config/database');

async function listTables() {
    try {
        const [rows] = await masterPool.query('SHOW TABLES');
        console.log('Tables:', rows.map(r => Object.values(r)[0]));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

listTables();
