const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');
const bcrypt = require('bcryptjs');

const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const regeneratePasswords = async () => {
    let connection;
    try {
        console.log('Starting password regeneration...');
        connection = await masterPool.getConnection();

        // Only select Regular students who already have credentials (to update them)
        // OR should we update ALL credentials regardless of status?
        // To match 'check_student_password_status', we might want to focus on Regular, 
        // but typically password regeneration should apply to all valid credentials.
        // However, the user complains about count mismatch.
        // check script: 4922 Regular total. 4616 have password.
        // This script found 4730 total (likely Regular + others).
        // Let's filter by Regular to align outputs.

        const [students] = await connection.query(`
            SELECT sc.id, sc.admission_number 
            FROM student_credentials sc
            JOIN students s ON sc.student_id = s.id
            WHERE s.student_status = 'Regular'
        `);

        console.log(`Found ${students.length} Regular students with credentials.`);

        let updatedCount = 0;
        const total = students.length;

        for (const student of students) {
            const newPassword = generateRandomPassword();
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await connection.query(
                'UPDATE student_credentials SET password_hash = ?, updated_at = NOW() WHERE id = ?',
                [hashedPassword, student.id]
            );

            updatedCount++;
            if (updatedCount % 100 === 0) {
                console.log(`Updated ${updatedCount}/${total} passwords...`);
            }
        }

        console.log('Password regeneration complete.');
        console.log(`Total passwords updated: ${updatedCount}`);

    } catch (error) {
        console.error('Error regenerating passwords:', error);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
};

regeneratePasswords();
