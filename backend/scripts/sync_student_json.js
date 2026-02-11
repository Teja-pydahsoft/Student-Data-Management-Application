const { masterPool } = require('../config/database');
require('dotenv').config();

async function syncStudentData() {
    console.log('--- Starting Student JSON Synchronization ---');

    try {
        // We update multiple JSON keys to ensure consistency regardless of how the field was originally mapped
        const query = `
      UPDATE students 
      SET 
        student_data = JSON_SET(
          IFNULL(student_data, '{}'), 
          '$.course', IFNULL(course, ''),
          '$.Course', IFNULL(course, ''),
          '$.branch', IFNULL(branch, ''),
          '$.Branch', IFNULL(branch, '')
        ),
        updated_at = updated_at -- Prevent updating timestamp unless data actually changes (or force it if you prefer)
      WHERE course IS NOT NULL OR branch IS NOT NULL
    `;

        console.log('Executing synchronization query...');
        const [result] = await masterPool.query(query);

        console.log('--- Synchronization Complete ---');
        console.log(`Total student records processed: ${result.affectedRows}`);
        console.log(`Records actually modified: ${result.changedRows}`);

        process.exit(0);
    } catch (error) {
        console.error('--- Synchronization Failed ---');
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

syncStudentData();
