const { masterPool } = require('../config/database');

async function fixSwappedData() {
    try {
        console.log('Starting data fix...');

        // Select records where holiday_reason looks like a timestamp (format YYYY-MM-DD HH:MM:SS)
        // and status is 'holiday'
        // We target the specific date 2025-12-18 to be safe, or generally. 
        // Given the user report, it's specific to recent entries.
        // The timestamp format from CURRENT_TIMESTAMP is typically 'YYYY-MM-DD HH:MM:SS'

        const [rows] = await masterPool.query(`
      SELECT id, holiday_reason 
      FROM attendance_records 
      WHERE status = 'holiday' 
        AND holiday_reason REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    `);

        console.log(`Found ${rows.length} swaped records.`);

        let fixedCount = 0;
        for (const row of rows) {
            const timestampFromReason = row.holiday_reason;

            // Update: Move timestamp to updated_at, set holiday_reason to NULL (or a placeholder text)
            // Since we lost the original reason, we can set it to "Manual Update Required" or similar, 
            // or just NULL so it doesn't show garbage.
            // But maybe "Holiday" is a safe default if reason is missing.

            await masterPool.query(`
        UPDATE attendance_records 
        SET updated_at = ?, 
            holiday_reason = NULL 
        WHERE id = ?
      `, [timestampFromReason, row.id]);

            fixedCount++;
        }

        console.log(`Successfully fixed ${fixedCount} records.`);
        process.exit(0);
    } catch (error) {
        console.error('Fix failed:', error);
        process.exit(1);
    }
}

fixSwappedData();
