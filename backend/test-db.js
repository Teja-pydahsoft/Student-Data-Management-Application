const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkStudentPhotos() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('Connected to database successfully');

    const [rows] = await connection.execute(
      'SELECT admission_number, student_photo FROM students WHERE student_photo IS NOT NULL AND student_photo != "" AND student_photo != "{}" LIMIT 10'
    );

    console.log('Students with photos:');
    rows.forEach(row => {
      console.log(`Admission: ${row.admission_number}, Photo: "${row.student_photo}"`);
    });

    await connection.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

checkStudentPhotos();
