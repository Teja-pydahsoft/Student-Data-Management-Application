const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkPhotoFieldConfiguration() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    });

    console.log('📸 Checking Photo Field Configuration');
    console.log('===================================');

    // Check if student_photo column exists in students table
    console.log('\n🔍 Checking students table structure...');
    const [columns] = await connection.execute(`
      SHOW COLUMNS FROM students WHERE Field = 'student_photo'
    `);

    if (columns.length > 0) {
      console.log(`✅ student_photo column exists:`);
      console.log(`   - Type: ${columns[0].Type}`);
      console.log(`   - Null: ${columns[0].Null}`);
      console.log(`   - Default: ${columns[0].Default}`);
    } else {
      console.log(`❌ student_photo column not found in students table`);
    }

    // Check forms for photo field configuration
    console.log('\n📋 Checking forms for photo field...');

    const [forms] = await connection.execute(`
      SELECT form_id, form_name, form_fields FROM forms
    `);

    for (const form of forms) {
      console.log(`\n📸 Form: ${form.form_name} (${form.form_id})`);

      if (form.form_fields) {
        try {
          const formFields = typeof form.form_fields === 'string'
            ? JSON.parse(form.form_fields)
            : form.form_fields;

          const photoField = formFields.find(field =>
            field.key && (
              field.key.toLowerCase().includes('photo') ||
              field.label && field.label.toLowerCase().includes('photo')
            )
          );

          if (photoField) {
            console.log(`   ✅ Photo field found:`);
            console.log(`      - Key: ${photoField.key}`);
            console.log(`      - Label: "${photoField.label}"`);
            console.log(`      - Type: ${photoField.type}`);
            console.log(`      - Required: ${photoField.required}`);
            console.log(`      - isEnabled: ${photoField.isEnabled}`);

            if (photoField.isEnabled === false) {
              console.log(`   ⚠️ Photo field is hidden from student form`);
            } else {
              console.log(`   ✅ Photo field is visible in student form`);
            }
          } else {
            console.log(`   ❌ No photo field found in form`);
          }

          // Check if form has any file upload fields
          const fileFields = formFields.filter(field =>
            field.type && (
              field.type === 'file' ||
              field.key.toLowerCase().includes('photo')
            )
          );

          if (fileFields.length > 0) {
            console.log(`   📎 File upload fields found: ${fileFields.length}`);
            fileFields.forEach(field => {
              console.log(`      - ${field.key}: ${field.label} (${field.type})`);
            });
          } else {
            console.log(`   📎 No file upload fields found`);
          }

        } catch (error) {
          console.log(`   ❌ Error parsing form fields:`, error.message);
        }
      }
    }

    // Check if there are any photos in the uploads folder
    const fs = require('fs');
    const uploadsDir = 'backend/uploads';

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const photoFiles = files.filter(file =>
        file.toLowerCase().includes('student') &&
        (file.toLowerCase().endsWith('.jpg') ||
         file.toLowerCase().endsWith('.jpeg') ||
         file.toLowerCase().endsWith('.png'))
      );

      console.log(`\n📁 Uploads folder check:`);
      console.log(`   - Total files: ${files.length}`);
      console.log(`   - Photo files: ${photoFiles.length}`);

      if (photoFiles.length > 0) {
        console.log(`   📸 Recent photo files:`);
        photoFiles.slice(0, 5).forEach(file => {
          console.log(`      - ${file}`);
        });
      }
    } else {
      console.log(`\n📁 Uploads folder not found`);
    }

    // Test photo upload endpoint availability
    console.log('\n🔗 Checking photo upload endpoint...');

    // Check if the route exists in the routes file
    const routePath = 'backend/routes/studentRoutes.js';
    if (fs.existsSync(routePath)) {
      const routeContent = fs.readFileSync(routePath, 'utf8');
      if (routeContent.includes('upload-photo')) {
        console.log(`   ✅ Photo upload route found: POST /upload-photo`);
      } else {
        console.log(`   ❌ Photo upload route not found`);
      }
    }

    console.log('\n🎉 Photo field configuration check completed!');

  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error('💡 Make sure your database credentials in .env are correct');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the check
checkPhotoFieldConfiguration();