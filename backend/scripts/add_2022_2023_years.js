/**
 * Script to add 2022 and 2023 academic years and create branches for them
 * 
 * Run with: node scripts/add_2022_2023_years.js
 */

const { masterPool } = require('../config/database');

async function add2022And2023Years() {
  console.log('🔄 Adding 2022 and 2023 academic years...\n');
  
  const connection = await masterPool.getConnection();
  
  try {
    // Step 1: Add 2022 and 2023 to academic_years table
    console.log('📦 Step 1: Adding academic years 2022 and 2023...');
    
    const yearsToAdd = [
      { label: '2022', startDate: '2022-06-01', endDate: '2023-05-31' },
      { label: '2023', startDate: '2023-06-01', endDate: '2024-05-31' }
    ];
    
    for (const year of yearsToAdd) {
      try {
        await connection.query(`
          INSERT INTO academic_years (year_label, start_date, end_date, is_active) 
          VALUES (?, ?, ?, TRUE)
        `, [year.label, year.startDate, year.endDate]);
        console.log(`   ✅ Added ${year.label}`);
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log(`   ⚠️  ${year.label} already exists`);
        } else {
          throw err;
        }
      }
    }
    
    // Step 2: Get the IDs of 2022 and 2023
    console.log('\n📦 Step 2: Getting 2022 and 2023 year IDs...');
    const [years] = await connection.query(
      `SELECT id, year_label FROM academic_years WHERE year_label IN ('2022', '2023') ORDER BY year_label`
    );
    
    console.log(`   Found ${years.length} years:`);
    years.forEach(y => console.log(`   - ${y.year_label} (ID: ${y.id})`));
    
    if (years.length === 0) {
      console.log('   ❌ No years found. Something went wrong.');
      return;
    }
    
    // Step 3: Get all unique branch templates
    console.log('\n📦 Step 3: Getting branch templates...');
    const [branchTemplates] = await connection.query(`
      SELECT DISTINCT
        cb.course_id, 
        cb.name, 
        MAX(cb.total_years) as total_years, 
        MAX(cb.semesters_per_year) as semesters_per_year,
        c.name as course_name
      FROM course_branches cb
      JOIN courses c ON cb.course_id = c.id
      WHERE cb.is_active = 1
      GROUP BY cb.course_id, cb.name, c.name
    `);
    
    console.log(`   Found ${branchTemplates.length} unique branch templates`);
    
    // Step 4: Create branches for 2022 and 2023
    console.log('\n📦 Step 4: Creating branches for 2022 and 2023...');
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const year of years) {
      console.log(`\n   📅 Processing ${year.year_label}:`);
      
      for (const template of branchTemplates) {
        // Check if this exact combination already exists
        const [existing] = await connection.query(`
          SELECT id FROM course_branches 
          WHERE course_id = ? AND name = ? AND academic_year_id = ?
        `, [template.course_id, template.name, year.id]);
        
        if (existing.length > 0) {
          skippedCount++;
          continue;
        }
        
        // Create the branch
        await connection.query(`
          INSERT INTO course_branches (course_id, name, total_years, semesters_per_year, academic_year_id, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [
          template.course_id,
          template.name,
          template.total_years,
          template.semesters_per_year,
          year.id
        ]);
        
        console.log(`      ✅ ${template.course_name} - ${template.name}`);
        createdCount++;
      }
    }
    
    // Final Summary
    console.log('\n🎉 Process completed!');
    console.log(`   - Created: ${createdCount} branch(es)`);
    console.log(`   - Skipped (already exist): ${skippedCount}`);
    
    // Show all years summary
    const [summary] = await connection.query(`
      SELECT 
        ay.year_label,
        COUNT(cb.id) as branch_count
      FROM academic_years ay
      LEFT JOIN course_branches cb ON cb.academic_year_id = ay.id AND cb.is_active = 1
      WHERE ay.is_active = 1
      GROUP BY ay.id, ay.year_label
      ORDER BY ay.year_label ASC
    `);
    
    console.log('\n📊 Final Summary by Academic Year:');
    for (const row of summary) {
      console.log(`   ${row.year_label}: ${row.branch_count} branch(es)`);
    }
    
    // Total branches
    const [totalCount] = await connection.query('SELECT COUNT(*) as total FROM course_branches WHERE is_active = 1');
    console.log(`\n   Total active branches: ${totalCount[0].total}`);
    
  } catch (error) {
    console.error('❌ Process failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

add2022And2023Years().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

