const { masterPool } = require('../config/database');

async function updateAutoAssign() {
  try {
    console.log('🔧 Updating auto-assign setting to always enabled...');

    const conn = await masterPool.getConnection();
    await conn.query(
      `UPDATE settings SET value = ? WHERE \`key\` = ?`,
      ['true', 'auto_assign_series']
    );
    conn.release();

    console.log('✅ Auto-assign setting updated to always enabled');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating auto-assign setting:', error);
    process.exit(1);
  }
}

updateAutoAssign();

