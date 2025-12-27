const { masterPool } = require('../config/database');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

const fixDates = async () => {
    try {
        console.log('--- Fix Date of Birth (One Day Offset) Script ---');
        console.log('This script will add 1 day to the Date of Birth for selected students.');
        console.log('This is useful if bulk uploaded dates were shifted back by one day due to timezone issues.');
        console.log('------------------------------------------------');

        const criteria = await askQuestion('Apply to (all/batch/admission): ');
        let query = 'SELECT id, admission_number, dob, student_data FROM students';
        let params = [];

        if (criteria === 'batch') {
            const batch = await askQuestion('Enter Batch (e.g., 2024): ');
            query += ' WHERE batch = ?';
            params.push(batch);
        } else if (criteria === 'admission') {
            const admission = await askQuestion('Enter Admission Number: ');
            query += ' WHERE admission_number = ?';
            params.push(admission);
        } else if (criteria !== 'all') {
            console.log('Invalid selection. Exiting.');
            process.exit(0);
        }

        const [students] = await masterPool.query(query, params);
        console.log(`Found ${students.length} students matching criteria.`);

        if (students.length === 0) {
            process.exit(0);
        }

        const confirm = await askQuestion(`Are you sure you want to update ${students.length} records? (yes/no): `);
        if (confirm.toLowerCase() !== 'yes') {
            console.log('Cancelled.');
            process.exit(0);
        }

        let updatedCount = 0;
        const connection = await masterPool.getConnection();

        try {
            await connection.beginTransaction();

            for (const student of students) {
                let needsUpdate = false;
                let newDob = null;
                let parsedData = {};

                // Parse student_data
                try {
                    parsedData = typeof student.student_data === 'string'
                        ? JSON.parse(student.student_data)
                        : student.student_data || {};
                } catch (e) {
                    parsedData = {};
                }

                // Check DB Column DOB
                if (student.dob) {
                    const date = new Date(student.dob);
                    // Add 1 day
                    date.setDate(date.getDate() + 1);

                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    newDob = `${year}-${month}-${day}`;
                    needsUpdate = true;
                }

                // Check student_data DOB
                const keysToCheck = ['dob', 'DOB (Date-Month-Year) Ex: 09-Sep-2003)', 'DOB (Date of Birth - DD-MM-YYYY)', 'date_of_birth', 'Date of Birth'];
                let jsonDobUpdated = false;

                keysToCheck.forEach(key => {
                    if (parsedData[key]) {
                        // Simple string check to avoid re-parsing if possible, but parsing is safer
                        // Assuming format YYYY-MM-DD from previous buggy upload
                        const d = new Date(parsedData[key]);
                        if (!isNaN(d.getTime())) {
                            d.setDate(d.getDate() + 1);
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            parsedData[key] = `${year}-${month}-${day}`;
                            jsonDobUpdated = true;
                        }
                    }
                });

                if (jsonDobUpdated) {
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    const updateQuery = 'UPDATE students SET dob = ?, student_data = ? WHERE id = ?';
                    await connection.query(updateQuery, [newDob || student.dob, JSON.stringify(parsedData), student.id]);
                    updatedCount++;
                    if (updatedCount % 100 === 0) process.stdout.write('.');
                }
            }

            await connection.commit();
            console.log(`\nSuccessfully updated ${updatedCount} students.`);

        } catch (err) {
            await connection.rollback();
            console.error('Error updating records:', err);
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Script error:', error);
    } finally {
        process.exit(0);
    }
};

fixDates();
