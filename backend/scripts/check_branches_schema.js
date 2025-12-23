const { masterPool } = require('../config/database');

async function checkBranches() {
    try {
        const [columns] = await masterPool.query('DESCRIBE course_branches');
        console.log('Columns in course_branches:', columns.map(c => c.Field));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkBranches();
