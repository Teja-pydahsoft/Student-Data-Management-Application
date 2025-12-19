const { masterPool } = require('../config/database');

async function checkStudentSchema() {
    try {
        const [columns] = await masterPool.execute('DESCRIBE students');
        console.log('Students Table Columns:', columns.map(c => c.Field));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkStudentSchema();
