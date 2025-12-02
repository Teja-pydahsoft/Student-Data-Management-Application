const mysql = require('mysql2/promise');
require('dotenv').config();

const MASTER_DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_database',
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  multipleStatements: true
};

const STAGING_DB_CONFIG = process.env.STAGING_DB_HOST
  ? {
      host: process.env.STAGING_DB_HOST,
      user: process.env.STAGING_DB_USER || process.env.DB_USER || 'root',
      password: process.env.STAGING_DB_PASSWORD || process.env.DB_PASSWORD || '',
      database: process.env.STAGING_DB_NAME || 'student_staging',
      port: process.env.STAGING_DB_PORT || process.env.DB_PORT || 3306,
      multipleStatements: true
    }
  : null;

async function ensureColumn(connection, dbName, columnName, columnDefinition) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) as count
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'students' AND column_name = ?`,
    [dbName, columnName]
  );

  if (rows[0].count === 0) {
    await connection.query(`ALTER TABLE students ADD COLUMN ${columnDefinition}`);
    console.log(`   • Added column ${columnName}`);
  } else {
    console.log(`   • Column ${columnName} already exists`);
  }
}

async function backfillDefaults(connection) {
  await connection.query(
    `UPDATE students
     SET current_year = IFNULL(current_year, 1),
         current_semester = IFNULL(current_semester, 1)`
  );
  console.log('   • Backfilled default values');
}

async function applyAlter(connection, label) {
  console.log(`\n⏳ Updating ${label} database...`);
  const [currentDb] = await connection.query('SELECT DATABASE() as name');
  const dbName = currentDb[0].name;

  await ensureColumn(connection, dbName, 'current_year', 'current_year TINYINT DEFAULT 1');
  await ensureColumn(connection, dbName, 'current_semester', 'current_semester TINYINT DEFAULT 1');
  await backfillDefaults(connection);

  console.log(`✅ ${label} database updated with academic stage columns.`);
}

async function run() {
  let masterConnection;
  let stagingConnection;

  try {
    console.log('=== Academic Stage Column Migration ===');

    masterConnection = await mysql.createConnection(MASTER_DB_CONFIG);
    console.log('Connected to master database.');
    await applyAlter(masterConnection, 'master');

    if (STAGING_DB_CONFIG) {
      try {
        stagingConnection = await mysql.createConnection(STAGING_DB_CONFIG);
        console.log('Connected to staging MySQL database.');
        await applyAlter(stagingConnection, 'staging');
      } catch (error) {
        console.warn('\n⚠️  Could not update staging MySQL database.');
        console.warn(
          '   All forms and submissions are now in MySQL. ' +
            'Otherwise verify your STAGING_DB_* environment variables and rerun this script.'
        );
        console.warn(`   Reason: ${error.message}`);
      }
    } else {
      console.log(
        '\nℹ️  No STAGING_DB_* environment variables detected. Skipping staging database update.'
      );
      console.log(
        '    All forms and submissions are now in MySQL.'
      );
    }

    console.log('\nMigration completed.\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (masterConnection) {
      await masterConnection.end();
    }
    if (stagingConnection) {
      await stagingConnection.end();
    }
  }
}

run();

