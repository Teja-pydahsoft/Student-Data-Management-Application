const { masterPool } = require('../config/database');

async function checkCollation() {
    try {
        const [studentCols] = await masterPool.execute("SHOW FULL COLUMNS FROM students WHERE Field = 'college'");
        const [collegeCols] = await masterPool.execute("SHOW FULL COLUMNS FROM colleges WHERE Field = 'name'");

        console.log('Student College Collation:', studentCols[0].Collation);
        console.log('College Name Collation:', collegeCols[0].Collation);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkCollation();
