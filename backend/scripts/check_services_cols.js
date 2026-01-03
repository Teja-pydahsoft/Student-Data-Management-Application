const { masterPool } = require('../config/database');

async function checkCols() {
    try {
        const [columns] = await masterPool.execute('DESCRIBE services');
        console.log('Columns in services table:');
        columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCols();
