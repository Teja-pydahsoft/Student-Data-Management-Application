const { masterPool } = require('../config/database');

async function checkBadData() {
    try {
        const [rows] = await masterPool.query(`
      SELECT id, student_id, attendance_date, status, holiday_reason, updated_at 
      FROM attendance_records 
      WHERE attendance_date = '2025-12-18' 
        AND status = 'holiday' 
        AND holiday_reason LIKE '2025-%' 
      LIMIT 5
    `);

        console.log('Bad Records Found:', rows.length);
        rows.forEach(row => {
            console.log('Row:', {
                id: row.id,
                holiday_reason: row.holiday_reason,
                updated_at: row.updated_at
            });
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkBadData();
