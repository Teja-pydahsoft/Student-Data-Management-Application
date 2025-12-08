const mysql = require('mysql2/promise');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function showStatistics(connection) {
  console.log('\n=== Student Fee Records Statistics ===\n');
  
  // Total records
  const [totalRows] = await connection.query(
    'SELECT COUNT(*) as total FROM student_fees'
  );
  console.log(`Total Fee Records: ${totalRows[0].total}`);
  
  // Records by fee header
  const [byHeader] = await connection.query(
    `SELECT 
      fh.header_name,
      COUNT(sf.id) as count,
      SUM(sf.amount) as total_amount,
      SUM(sf.paid_amount) as total_paid
    FROM student_fees sf
    INNER JOIN fee_headers fh ON sf.fee_header_id = fh.id
    GROUP BY fh.id, fh.header_name
    ORDER BY count DESC`
  );
  
  if (byHeader.length > 0) {
    console.log('\nRecords by Fee Header:');
    console.log('─'.repeat(80));
    console.log(`${'Fee Header'.padEnd(30)} ${'Count'.padEnd(10)} ${'Total Amount'.padEnd(15)} ${'Total Paid'.padEnd(15)}`);
    console.log('─'.repeat(80));
    byHeader.forEach(row => {
      console.log(
        `${row.header_name.padEnd(30)} ${String(row.count).padEnd(10)} ₹${parseFloat(row.total_amount || 0).toLocaleString('en-IN').padEnd(14)} ₹${parseFloat(row.total_paid || 0).toLocaleString('en-IN').padEnd(14)}`
      );
    });
  }
  
  // Records by year and semester
  const [byYearSem] = await connection.query(
    `SELECT 
      COALESCE(year, 'NULL') as year,
      COALESCE(semester, 'NULL') as semester,
      COUNT(*) as count
    FROM student_fees
    GROUP BY year, semester
    ORDER BY 
      CASE WHEN year IS NULL THEN 1 ELSE 0 END,
      year,
      CASE WHEN semester IS NULL THEN 1 ELSE 0 END,
      semester`
  );
  
  if (byYearSem.length > 0) {
    console.log('\nRecords by Year and Semester:');
    console.log('─'.repeat(50));
    console.log(`${'Year'.padEnd(10)} ${'Semester'.padEnd(10)} ${'Count'.padEnd(10)}`);
    console.log('─'.repeat(50));
    byYearSem.forEach(row => {
      console.log(`${String(row.year).padEnd(10)} ${String(row.semester).padEnd(10)} ${String(row.count).padEnd(10)}`);
    });
  }
  
  // Records with and without year/semester
  const [withYearSem] = await connection.query(
    'SELECT COUNT(*) as count FROM student_fees WHERE year IS NOT NULL AND semester IS NOT NULL'
  );
  const [withoutYearSem] = await connection.query(
    'SELECT COUNT(*) as count FROM student_fees WHERE year IS NULL OR semester IS NULL'
  );
  
  console.log('\nRecords with Year/Semester:', withYearSem[0].count);
  console.log('Records without Year/Semester:', withoutYearSem[0].count);
  
  // Sample records
  const [samples] = await connection.query(
    `SELECT 
      sf.id,
      s.student_name,
      fh.header_name,
      sf.amount,
      sf.paid_amount,
      sf.year,
      sf.semester
    FROM student_fees sf
    INNER JOIN students s ON sf.student_id = s.id
    INNER JOIN fee_headers fh ON sf.fee_header_id = fh.id
    ORDER BY sf.id DESC
    LIMIT 5`
  );
  
  if (samples.length > 0) {
    console.log('\nSample Records (Latest 5):');
    console.log('─'.repeat(100));
    samples.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id} | Student: ${row.student_name} | Fee: ${row.header_name} | Amount: ₹${row.amount} | Paid: ₹${row.paid_amount} | Year: ${row.year || 'NULL'} | Sem: ${row.semester || 'NULL'}`);
    });
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

async function deleteAllRecords(connection) {
  console.log('\n⚠️  WARNING: This will delete ALL student fee records from the database!');
  console.log('This action cannot be undone.\n');
  
  const confirm1 = await question('Type "DELETE ALL" to confirm: ');
  if (confirm1 !== 'DELETE ALL') {
    console.log('Deletion cancelled.');
    return false;
  }
  
  const confirm2 = await question('Are you absolutely sure? Type "YES" to proceed: ');
  if (confirm2 !== 'YES') {
    console.log('Deletion cancelled.');
    return false;
  }
  
  console.log('\nDeleting all student fee records...');
  const [result] = await connection.query('DELETE FROM student_fees');
  console.log(`✅ Successfully deleted ${result.affectedRows} records.`);
  return true;
}

async function deleteByYearSemester(connection) {
  const year = await question('Enter Year (or press Enter to skip): ');
  const semester = await question('Enter Semester (or press Enter to skip): ');
  
  let query = 'DELETE FROM student_fees WHERE 1=1';
  const params = [];
  
  if (year && year.trim()) {
    query += ' AND year = ?';
    params.push(parseInt(year));
  }
  
  if (semester && semester.trim()) {
    query += ' AND semester = ?';
    params.push(parseInt(semester));
  }
  
  if (params.length === 0) {
    console.log('No filters specified. Cancelled.');
    return false;
  }
  
  // Show what will be deleted
  let countQuery = 'SELECT COUNT(*) as count FROM student_fees WHERE 1=1';
  if (year && year.trim()) {
    countQuery += ' AND year = ?';
  }
  if (semester && semester.trim()) {
    countQuery += ' AND semester = ?';
  }
  
  const [countResult] = await connection.query(countQuery, params);
  const count = countResult[0].count;
  
  console.log(`\n⚠️  This will delete ${count} record(s) where:`);
  if (year && year.trim()) console.log(`   Year = ${year}`);
  if (semester && semester.trim()) console.log(`   Semester = ${semester}`);
  
  const confirm = await question('\nType "DELETE" to confirm: ');
  if (confirm !== 'DELETE') {
    console.log('Deletion cancelled.');
    return false;
  }
  
  console.log('\nDeleting records...');
  const [result] = await connection.query(query, params);
  console.log(`✅ Successfully deleted ${result.affectedRows} records.`);
  return true;
}

async function deleteWithoutYearSemester(connection) {
  const [countResult] = await connection.query(
    'SELECT COUNT(*) as count FROM student_fees WHERE year IS NULL OR semester IS NULL'
  );
  const count = countResult[0].count;
  
  if (count === 0) {
    console.log('No records without year/semester found.');
    return false;
  }
  
  console.log(`\n⚠️  This will delete ${count} record(s) that don't have year or semester.`);
  const confirm = await question('Type "DELETE" to confirm: ');
  if (confirm !== 'DELETE') {
    console.log('Deletion cancelled.');
    return false;
  }
  
  console.log('\nDeleting records...');
  const [result] = await connection.query(
    'DELETE FROM student_fees WHERE year IS NULL OR semester IS NULL'
  );
  console.log(`✅ Successfully deleted ${result.affectedRows} records.`);
  return true;
}

async function deleteByFeeHeader(connection) {
  // Get all fee headers
  const [headers] = await connection.query(
    'SELECT id, header_name FROM fee_headers ORDER BY header_name'
  );
  
  if (headers.length === 0) {
    console.log('No fee headers found.');
    return false;
  }
  
  console.log('\nAvailable Fee Headers:');
  headers.forEach((header, index) => {
    console.log(`${index + 1}. ${header.header_name} (ID: ${header.id})`);
  });
  
  const headerInput = await question('\nEnter fee header ID or name (or press Enter to cancel): ');
  if (!headerInput || !headerInput.trim()) {
    console.log('Cancelled.');
    return false;
  }
  
  let headerId = null;
  const headerIdNum = parseInt(headerInput);
  if (!isNaN(headerIdNum)) {
    headerId = headerIdNum;
  } else {
    const found = headers.find(h => h.header_name.toLowerCase().includes(headerInput.toLowerCase()));
    if (found) {
      headerId = found.id;
    } else {
      console.log('Fee header not found.');
      return false;
    }
  }
  
  const [countResult] = await connection.query(
    'SELECT COUNT(*) as count FROM student_fees WHERE fee_header_id = ?',
    [headerId]
  );
  const count = countResult[0].count;
  
  const headerName = headers.find(h => h.id === headerId)?.header_name || 'Unknown';
  console.log(`\n⚠️  This will delete ${count} record(s) for fee header: ${headerName}`);
  const confirm = await question('Type "DELETE" to confirm: ');
  if (confirm !== 'DELETE') {
    console.log('Deletion cancelled.');
    return false;
  }
  
  console.log('\nDeleting records...');
  const [result] = await connection.query(
    'DELETE FROM student_fees WHERE fee_header_id = ?',
    [headerId]
  );
  console.log(`✅ Successfully deleted ${result.affectedRows} records.`);
  return true;
}

async function main() {
  let connection;
  
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_database'
    });
    
    console.log('✅ Connected to database\n');
    
    while (true) {
      // Show statistics first
      await showStatistics(connection);
      
      console.log('Options:');
      console.log('1. Show statistics again');
      console.log('2. Delete ALL student fee records');
      console.log('3. Delete records by Year/Semester');
      console.log('4. Delete records without Year/Semester');
      console.log('5. Delete records by Fee Header');
      console.log('6. Exit');
      
      const choice = await question('\nEnter your choice (1-6): ');
      
      switch (choice.trim()) {
        case '1':
          // Statistics already shown, continue loop
          break;
        case '2':
          await deleteAllRecords(connection);
          break;
        case '3':
          await deleteByYearSemester(connection);
          break;
        case '4':
          await deleteWithoutYearSemester(connection);
          break;
        case '5':
          await deleteByFeeHeader(connection);
          break;
        case '6':
          console.log('\nExiting...');
          rl.close();
          await connection.end();
          process.exit(0);
        default:
          console.log('Invalid choice. Please try again.');
      }
      
      if (choice.trim() !== '6') {
        const continueChoice = await question('\nPress Enter to continue...');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    rl.close();
  }
}

// Run the script
main().catch(console.error);
