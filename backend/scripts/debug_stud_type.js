require('dotenv').config({ path: 'backend/.env' });
const { masterPool } = require('../config/database');

const check = async () => {
    try {
        const [rows] = await masterPool.query('SELECT DISTINCT student_status FROM students');
        console.log('Distinct student_status:', rows);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

check();
