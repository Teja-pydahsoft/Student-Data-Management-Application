require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const EXCLUDED_COURSES = ['M.Tech', 'MBA', 'MCS', 'M Sc Aqua', 'MCA', 'M.Pharma', 'M Pharma'];

async function migrateExclusions() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected to database.');

        // Check if config already exists
        const [rows] = await connection.query('SELECT value FROM settings WHERE `key` = ?', ['attendance_config']);

        let attendanceConfig = {
            excludedCourses: [],
            excludedStudents: []
        };

        if (rows.length > 0) {
            try {
                attendanceConfig = JSON.parse(rows[0].value);
                console.log('Existing config found:', attendanceConfig);
            } catch (e) {
                console.warn('Failed to parse existing config, overwriting.');
            }
        }

        // Merge logic: Add hardcoded ones if not present
        let addedCount = 0;
        EXCLUDED_COURSES.forEach(course => {
            if (!attendanceConfig.excludedCourses.includes(course)) {
                attendanceConfig.excludedCourses.push(course);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            const value = JSON.stringify(attendanceConfig);
            await connection.query(
                `INSERT INTO settings (\`key\`, value, updated_at) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE value = ?, updated_at = ?`,
                ['attendance_config', value, new Date(), value, new Date()]
            );
            console.log(`Successfully migrated ${addedCount} courses to attendance settings.`);
        } else {
            console.log('All legacy courses are already present in settings.');
        }

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        if (connection) await connection.end();
    }
}

migrateExclusions();
