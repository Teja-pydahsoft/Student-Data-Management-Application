require('dotenv').config({ path: './backend/.env' });
const { masterPool } = require('../config/database');

async function fixCreatedByConstraint() {
    try {
        console.log('Fixing created_by foreign key constraint...');

        // Drop the existing foreign key constraint
        await masterPool.query(`
            ALTER TABLE clubs 
            DROP FOREIGN KEY clubs_ibfk_1
        `);
        console.log('Dropped existing foreign key constraint.');

        // Make created_by nullable and add it back without strict constraint
        await masterPool.query(`
            ALTER TABLE clubs 
            MODIFY COLUMN created_by INT NULL
        `);
        console.log('Modified created_by to be nullable.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

fixCreatedByConstraint();
