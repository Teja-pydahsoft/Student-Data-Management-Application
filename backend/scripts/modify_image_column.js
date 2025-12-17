require('dotenv').config({ path: 'backend/.env' });
const { masterPool } = require('../config/database');

const updateSchema = async () => {
    try {
        console.log('Modifying image_url column to LONGTEXT...');
        await masterPool.query('ALTER TABLE announcements MODIFY COLUMN image_url LONGTEXT');
        console.log('Success.');
        process.exit(0);
    } catch (error) {
        console.error('Failed:', error);
        process.exit(1);
    }
};

updateSchema();
