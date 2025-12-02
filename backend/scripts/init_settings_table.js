const { masterPool } = require('../config/database');

async function initSettingsTable() {
  try {
    console.log('🔧 Initializing settings table in MySQL...');

    // Create settings table if it doesn't exist
    await masterPool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        \`key\` VARCHAR(255) UNIQUE NOT NULL,
        value LONGTEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key (\`key\`)
      )
    `);

    console.log('✅ Settings table created/verified');

    // Insert default setting if it doesn't exist (always enabled by default)
    await masterPool.query(
      `INSERT INTO settings (\`key\`, value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE value = ?`,
      ['auto_assign_series', 'true', 'true']
    );

    console.log('✅ Default setting inserted/verified');
    console.log('✅ Settings table initialization complete');

  } catch (error) {
    console.error('❌ Init settings table error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

initSettingsTable();
