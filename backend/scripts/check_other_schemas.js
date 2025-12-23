const { masterPool } = require('../config/database');

async function checkSchemas() {
    try {
        const [cCols] = await masterPool.query('DESCRIBE colleges');
        console.log('Colleges:', cCols.map(c => c.Field));

        const [coCols] = await masterPool.query('DESCRIBE courses');
        console.log('Courses:', coCols.map(c => c.Field));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkSchemas();
