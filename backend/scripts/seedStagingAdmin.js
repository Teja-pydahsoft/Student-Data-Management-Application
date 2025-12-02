const { masterPool } = require('../config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedStagingAdmin() {
  let connection;
  try {
    connection = await masterPool.getConnection();

    console.log('📦 Seeding admin user in MySQL database');

    // Ensure admins table exists (minimal guard)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`);

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const email = 'admin@example.com';
    const hashed = await bcrypt.hash(password, 10);

    await connection.query(
      `INSERT INTO admins (username, password, email)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE username=username`,
      [username, hashed, email]
    );

    console.log(`✅ Admin user ensured: ${username}`);
    console.log('   Tip: change ADMIN_PASSWORD after first login.');

  } catch (err) {
    console.error('❌ Failed to seed admin:', err.message || err);
    process.exit(1);
  } finally {
    if (connection) connection.release();
  }
}

seedStagingAdmin();
