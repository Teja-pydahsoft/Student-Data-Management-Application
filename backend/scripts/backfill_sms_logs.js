const { masterPool } = require('../config/database');

const backfill = async () => {
    try {
        console.log('Starting backfill/update of attendance SMS logs...');

        // 1. Fetch relevant attendance records
        const [records] = await masterPool.query(`
      SELECT 
        ar.id,
        ar.student_id,
        ar.attendance_date,
        s.parent_mobile1,
        s.parent_mobile2,
        s.student_mobile,
        s.admission_number,
        s.current_year,
        s.current_semester
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      WHERE ar.sms_sent = 1 AND ar.status = 'absent'
    `);

        console.log(`Found ${records.length} absent records with SMS sent.`);

        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // Process in chunks
        const chunkSize = 100;
        for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);

            await Promise.all(chunk.map(async (record) => {
                try {
                    const date = new Date(record.attendance_date);
                    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

                    // Format date for message (DD-MM-YYYY)
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const formattedDate = `${day}-${month}-${year}`;

                    // Check if log entry exists for this student + date + category
                    const [existing] = await masterPool.query(`
            SELECT id, current_year, current_semester FROM sms_logs 
            WHERE student_id = ? 
            AND category = 'Attendance' 
            AND DATE(sent_at) = ?
          `, [record.student_id, dateStr]);

                    // Use the student's CURRENT year/sem as the best available data
                    const studentYear = record.current_year || null;
                    const studentSem = record.current_semester || null;

                    if (existing.length > 0) {
                        // Log exists. Check if we need to backfill year/sem columns if they are null
                        const logEntry = existing[0];
                        if (logEntry.current_year === null || logEntry.current_semester === null) {
                            await masterPool.query(`
                UPDATE sms_logs 
                SET current_year = ?, current_semester = ?
                WHERE id = ?
              `, [studentYear, studentSem, logEntry.id]);
                            updatedCount++;
                        } else {
                            skippedCount++;
                        }
                        return;
                    }

                    // Insert new log if not exists
                    const mobile = record.parent_mobile1 || record.parent_mobile2 || record.student_mobile || '';
                    const message = `Dear Parent, your ward is absent today i.e., on ${formattedDate} Principal, PYDAH.`;
                    const sentAt = `${dateStr} 10:00:00`;

                    await masterPool.query(`
            INSERT INTO sms_logs 
            (student_id, mobile_number, message, category, status, sent_at, error_details, current_year, current_semester)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
                        record.student_id,
                        mobile,
                        message,
                        'Attendance',
                        'Sent',
                        sentAt,
                        'Backfilled from history',
                        studentYear,
                        studentSem
                    ]);

                    insertedCount++;
                } catch (err) {
                    console.error(`Error processing record for student ${record.admission_number}:`, err.message);
                    errorCount++;
                }
            }));

            if (i + chunkSize < records.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        console.log(`Backfill/Update complete.`);
        console.log(`Inserted: ${insertedCount}`);
        console.log(`Updated (filled missing year/sem): ${updatedCount}`);
        console.log(`Skipped (already complete): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (error) {
        console.error('Backfill failed:', error);
    } finally {
        process.exit();
    }
};

backfill();
