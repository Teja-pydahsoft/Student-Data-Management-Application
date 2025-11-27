require('dotenv').config();
const { masterPool } = require('../config/database');

const fixes = [
  { old: 'CSE(AI)', new: 'DCSE(AI)', course: 'Diploma' },
  { old: 'CSE', new: 'DCSE', course: 'Diploma' },
  { old: 'ECE', new: 'DECE', course: 'Diploma' },
  { old: 'MEC', new: 'DMEC', course: 'Diploma' },
];

(async () => {
  console.log('='.repeat(50));
  console.log('APPLYING BRANCH FIXES');
  console.log('='.repeat(50));

  let totalUpdated = 0;

  try {
    for (const fix of fixes) {
      const [result] = await masterPool.query(
        `UPDATE students SET branch = ?, updated_at = CURRENT_TIMESTAMP WHERE branch = ? AND course = ?`,
        [fix.new, fix.old, fix.course]
      );
      console.log(`✅ "${fix.old}" → "${fix.new}": ${result.affectedRows} students updated`);
      totalUpdated += result.affectedRows;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`TOTAL: ${totalUpdated} student records updated!`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await masterPool.end();
    process.exit(0);
  }
})();

