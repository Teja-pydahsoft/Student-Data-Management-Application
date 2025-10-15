const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { supabase } = require('../config/supabase');

async function seedStagingAdmin() {
  // Prefer Supabase for staging when available
  if (supabase) {
    try {
      console.log('\ud83d\udce6 Using Supabase for staging admin seeding');
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'admin123';
      const email = 'admin@example.com';
      const hashed = await bcrypt.hash(password, 10);

      // Ensure admins table exists is not possible from supabase-js directly; rely on the table existing
      // Upsert admin
      const { data, error } = await supabase
        .from('admins')
        .upsert([
          { username: username, password: hashed, email: email }
        ], { onConflict: 'username' });

      if (error) throw error;

      console.log(`\u2705 Supabase staging admin ensured: ${username}`);
      console.log('   Tip: change ADMIN_PASSWORD after first login.');
      return;
    } catch (err) {
      console.error('\u274c Supabase seed failed:', err.message || err);
      // fallthrough to MySQL fallback
    }
  }

  // Fallback to MySQL staging
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

    console.log('\ud83d\udce6 Connected to staging DB (MySQL fallback)');

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

    console.log(`\u2705 Staging admin ensured: ${username}`);
    console.log('   Tip: change ADMIN_PASSWORD after first login.');

  } catch (err) {
    console.error('\u274c Failed to seed staging admin (MySQL):', err.message || err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seedStagingAdmin();


