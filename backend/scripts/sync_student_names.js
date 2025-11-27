/**
 * One-time script to sync student course/branch/college names
 * with the current names in master tables.
 * 
 * Run this script when you have already renamed courses/branches/colleges
 * and need to update existing student records.
 * 
 * Usage: node scripts/sync_student_names.js
 */

require('dotenv').config();
const { masterPool } = require('../config/database');

async function syncStudentNames() {
  console.log('='.repeat(60));
  console.log('Student Names Sync Script');
  console.log('='.repeat(60));
  
  try {
    // 1. Find orphaned students (students with course/branch names that don't exist)
    console.log('\n📊 Analyzing student data...\n');

    // Get all unique course names from students
    const [studentCourses] = await masterPool.query(
      `SELECT DISTINCT course FROM students WHERE course IS NOT NULL AND course != ''`
    );
    
    // Get all active courses
    const [activeCourses] = await masterPool.query(
      `SELECT id, name FROM courses WHERE is_active = 1`
    );
    
    const activeCourseNames = new Set(activeCourses.map(c => c.name.toLowerCase()));
    
    // Find orphaned course names
    const orphanedCourses = studentCourses.filter(
      s => !activeCourseNames.has(s.course.toLowerCase())
    );
    
    if (orphanedCourses.length > 0) {
      console.log('⚠️  Found students with courses that no longer exist:');
      for (const oc of orphanedCourses) {
        const [count] = await masterPool.query(
          'SELECT COUNT(*) as cnt FROM students WHERE course = ?',
          [oc.course]
        );
        console.log(`   - "${oc.course}" (${count[0].cnt} students)`);
      }
    } else {
      console.log('✅ All student courses match active courses.');
    }

    // Get all unique branch names from students
    const [studentBranches] = await masterPool.query(
      `SELECT DISTINCT branch, course FROM students WHERE branch IS NOT NULL AND branch != ''`
    );
    
    // Get all active branches
    const [activeBranches] = await masterPool.query(
      `SELECT cb.id, cb.name, c.name as course_name 
       FROM course_branches cb 
       JOIN courses c ON cb.course_id = c.id 
       WHERE cb.is_active = 1`
    );
    
    const activeBranchMap = new Map();
    activeBranches.forEach(b => {
      const key = `${b.course_name.toLowerCase()}|${b.name.toLowerCase()}`;
      activeBranchMap.set(key, b);
    });
    
    // Find orphaned branch names
    const orphanedBranches = studentBranches.filter(s => {
      const key = `${(s.course || '').toLowerCase()}|${s.branch.toLowerCase()}`;
      return !activeBranchMap.has(key);
    });
    
    if (orphanedBranches.length > 0) {
      console.log('\n⚠️  Found students with branches that no longer exist:');
      for (const ob of orphanedBranches) {
        const [count] = await masterPool.query(
          'SELECT COUNT(*) as cnt FROM students WHERE branch = ? AND course = ?',
          [ob.branch, ob.course]
        );
        console.log(`   - "${ob.branch}" (course: ${ob.course}) - ${count[0].cnt} students`);
      }
    } else {
      console.log('✅ All student branches match active branches.');
    }

    // Get all unique college names from students
    const [studentColleges] = await masterPool.query(
      `SELECT DISTINCT college FROM students WHERE college IS NOT NULL AND college != ''`
    );
    
    // Get all active colleges
    const [activeColleges] = await masterPool.query(
      `SELECT id, name FROM colleges WHERE is_active = 1`
    );
    
    const activeCollegeNames = new Set(activeColleges.map(c => c.name.toLowerCase()));
    
    // Find orphaned college names
    const orphanedColleges = studentColleges.filter(
      s => !activeCollegeNames.has(s.college.toLowerCase())
    );
    
    if (orphanedColleges.length > 0) {
      console.log('\n⚠️  Found students with colleges that no longer exist:');
      for (const oc of orphanedColleges) {
        const [count] = await masterPool.query(
          'SELECT COUNT(*) as cnt FROM students WHERE college = ?',
          [oc.college]
        );
        console.log(`   - "${oc.college}" (${count[0].cnt} students)`);
      }
    } else {
      console.log('✅ All student colleges match active colleges.');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Orphaned courses: ${orphanedCourses.length}`);
    console.log(`Orphaned branches: ${orphanedBranches.length}`);
    console.log(`Orphaned colleges: ${orphanedColleges.length}`);

    if (orphanedCourses.length > 0 || orphanedBranches.length > 0 || orphanedColleges.length > 0) {
      console.log('\n📝 To fix these, you can run UPDATE queries manually.');
      console.log('   Example: UPDATE students SET course = "NewName" WHERE course = "OldName";');
      console.log('\n   Or use the interactive fix mode below.\n');
      
      // Interactive fix suggestions
      if (orphanedCourses.length > 0) {
        console.log('--- COURSE FIX QUERIES ---');
        for (const oc of orphanedCourses) {
          // Try to find a similar course name
          const similar = activeCourses.find(
            ac => ac.name.toLowerCase().includes(oc.course.toLowerCase().substring(0, 3)) ||
                  oc.course.toLowerCase().includes(ac.name.toLowerCase().substring(0, 3))
          );
          if (similar) {
            console.log(`UPDATE students SET course = '${similar.name}' WHERE course = '${oc.course}';`);
          } else {
            console.log(`-- No similar course found for "${oc.course}". Manual mapping required.`);
            console.log(`-- Available courses: ${activeCourses.map(c => c.name).join(', ')}`);
          }
        }
      }

      if (orphanedBranches.length > 0) {
        console.log('\n--- BRANCH FIX QUERIES ---');
        for (const ob of orphanedBranches) {
          // Try to find similar branch
          const similar = activeBranches.find(
            ab => ab.course_name === ob.course && 
                  (ab.name.toLowerCase().includes(ob.branch.toLowerCase().substring(0, 3)) ||
                   ob.branch.toLowerCase().includes(ab.name.toLowerCase().substring(0, 3)))
          );
          if (similar) {
            console.log(`UPDATE students SET branch = '${similar.name}' WHERE branch = '${ob.branch}' AND course = '${ob.course}';`);
          } else {
            console.log(`-- No similar branch found for "${ob.branch}" in course "${ob.course}". Manual mapping required.`);
          }
        }
      }

      if (orphanedColleges.length > 0) {
        console.log('\n--- COLLEGE FIX QUERIES ---');
        for (const oc of orphanedColleges) {
          // Try to find a similar college name
          const similar = activeColleges.find(
            ac => ac.name.toLowerCase().includes(oc.college.toLowerCase().substring(0, 5)) ||
                  oc.college.toLowerCase().includes(ac.name.toLowerCase().substring(0, 5))
          );
          if (similar) {
            console.log(`UPDATE students SET college = '${similar.name}' WHERE college = '${oc.college}';`);
          } else {
            console.log(`-- No similar college found for "${oc.college}". Manual mapping required.`);
            console.log(`-- Available colleges: ${activeColleges.map(c => c.name).join(', ')}`);
          }
        }
      }
    } else {
      console.log('\n✅ No fixes needed. All student data is in sync!');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await masterPool.end();
    console.log('\n' + '='.repeat(60));
    console.log('Script completed.');
    process.exit(0);
  }
}

syncStudentNames();

