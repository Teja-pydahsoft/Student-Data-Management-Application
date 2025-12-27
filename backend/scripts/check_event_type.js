const { masterPool } = require('../config/database');

const checkSchema = async () => {
    try {
        const [rows] = await masterPool.query("SHOW COLUMNS FROM events LIKE 'event_type'");
        console.log('Column Type:', rows[0].Type);
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
};

checkSchema();
