const { masterPool } = require('../config/database');

async function listTables() {
    try {
        const [tables] = await masterPool.execute('SHOW TABLES');
        console.log('Tables in student_database:');
        tables.forEach(row => {
            const tableName = Object.values(row)[0];
            console.log(`- ${tableName}`);
        });
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listTables();
