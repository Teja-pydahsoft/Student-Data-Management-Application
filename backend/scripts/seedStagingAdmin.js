const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedStagingAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.STAGING_DB_HOST || process.env.DB_HOST || 'localhost',
      user: process.env.STAGING_DB_USER || process.env.DB_USER || 'root',
      password: process.env.STAGING_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.STAGING_DB_NAME || 'student_staging',
      port: process.env.STAGING_DB_PORT || process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('📦 Connected to staging DB');

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

    console.log(`✅ Staging admin ensured: ${username}`);
    console.log('   Tip: change ADMIN_PASSWORD after first login.');

  } catch (err) {
    console.error('❌ Failed to seed staging admin:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seedStagingAdmin();


