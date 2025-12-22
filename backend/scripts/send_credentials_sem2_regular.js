const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { masterPool } = require('../config/database');
const { generateStudentCredentials } = require('../utils/studentCredentials');

/**
 * Script to send credentials to students in Semester 2 with Regular status.
 * This will REGENERATE passwords to the default format and SMS them.
 */
async function sendCredentialsToSem2Regular() {
    let connection;

    try {
        connection = await masterPool.getConnection();
        console.log('📦 Connected to database');

        console.log('\n📚 Fetching "Regular" students in "Semester 2"...');

        // Query to find target students
        // We check for '2' in current_semester.
        // We check for 'Regular' (case-insensitive usually, but using OR for safety) in student_status.
        const [students] = await connection.query(`
      SELECT id, admission_number, pin_no, student_name, student_mobile, current_semester, student_status
      FROM students
      WHERE (current_semester = '2' OR current_semester = 2)
      AND (student_status = 'Regular' OR student_status = 'regular')
      ORDER BY id
    `);

        console.log(`Found ${students.length} students to process.\n`);

        if (students.length === 0) {
            console.log('No students found matching the criteria.');
            process.exit(0);
        }

        console.log('⚠️  WARNING: This will reset passwords for all these students and send SMS.');
        console.log('⚠️  Starting in 5 seconds... (Ctrl+C to cancel)');
        await new Promise(resolve => setTimeout(resolve, 5000));

        let successCount = 0;
        let errorCount = 0;

        for (const student of students) {
            console.log(`\nProcessing: ${student.admission_number} (${student.student_name})`);

            try {
                // generateStudentCredentials handles:
                // 1. Validation
                // 2. Credential generation/update (Resetting password)
                // 3. Sending SMS
                // We pass isPasswordReset = true to use the "password updated" template if preferred,
                // OR false to use "account created". 
                // Since we are "sending credentials", "account created" or "password reset" are both valid.
                // Let's use false (account created style) as it feels like a "here are your creds" blast.
                // Actually, the user said "send the credentials", so let's stick to the standard flow.
                const result = await generateStudentCredentials(
                    student.id,
                    student.admission_number,
                    student.pin_no,
                    student.student_name,
                    student.student_mobile,
                    false // isPasswordReset flag. False = "Account Created" template.
                );

                if (result.success) {
                    console.log(`   ✅ Success: User=${result.username}, Pass=${result.password}`);
                    successCount++;
                } else {
                    console.error(`   ❌ Failed: ${result.error}`);
                    errorCount++;
                }

            } catch (err) {
                console.error(`   ❌ Exception: ${err.message}`);
                errorCount++;
            }

            // Small delay to be nice to the SMS API rate limits if any
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Sent/Processed: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            connection.release();
        }
        process.exit(0);
    }
}

// Run the function
sendCredentialsToSem2Regular();
