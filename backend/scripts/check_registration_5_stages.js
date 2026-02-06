/**
 * =============================================================================
 * REGISTRATION 5-STAGE AUDIT SCRIPT
 * =============================================================================
 *
 * PURPOSE
 * --------
 * Compare each student's stored "registration_status" (Completed vs pending) with
 * whether they have actually completed all 5 registration stages. This finds:
 *   - Correctly completed: all 5 stages done AND status = Completed
 *   - Falsely completed: status = Completed but one or more stages NOT done
 *   - Should be completed: all 5 stages done but status NOT Completed
 *   - Correctly pending: not all 5 stages and status = pending
 *
 * THE 5 STAGES (all must be true for "registration completed")
 * -----------------------------------------------------------
 * | # | Stage        | Source (DB)        | Condition for "done"                    |
 * |---|--------------|---------------------|------------------------------------------|
 * | 1 | Verification | student_data (JSON) | is_student_mobile_verified AND           |
 * |   |              |                     | is_parent_mobile_verified both true       |
 * | 2 | Certificates | certificates_status| value contains "verified" or = "completed" |
 * | 3 | Fee          | fee_status         | value contains: no_due, nodue, no due,   |
 * |   |              |                     | permitted, completed, partially_completed, partial |
 * | 4 | Promotion    | current_year,      | both set and non-empty                   |
 * |   |              | current_semester   |                                          |
 * | 5 | Scholarship  | scholar_status     | non-empty (any value = reviewed; empty = pending) |
 *
 * Only "Regular" students (student_status = 'Regular') are included.
 *
 * USAGE
 * -----
 *   node backend/scripts/check_registration_5_stages.js
 *     → Report only. No DB changes.
 *
 *   node backend/scripts/check_registration_5_stages.js --fix
 *     → Report + set registration_status to "pending" for all falsely completed.
 *
 *   node backend/scripts/check_registration_5_stages.js --fix-all
 *     → Same as --fix, plus set registration_status to "Completed" for students
 *       who have all 5 stages but are not marked Completed.
 *
 * OUTPUT
 * ------
 * - Summary counts (total, correctly completed, falsely completed, etc.)
 * - Stage-wise counts (how many have each stage done)
 * - List of falsely completed with missing stages
 * - If --fix/--fix-all: progress logs for DB updates
 * =============================================================================
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { masterPool } = require('../config/database');

const columnExists = async (columnName) => {
  try {
    const [rows] = await masterPool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'students'
         AND COLUMN_NAME = ?`,
      [columnName]
    );
    return Number(rows?.[0]?.count || 0) > 0;
  } catch (_e) {
    return false;
  }
};

function parseJSON(val) {
  if (val == null) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val || '{}');
  } catch (_e) {
    return {};
  }
}

/**
 * Returns per-stage and overall completion for one student.
 * Data: row from students (student_data, certificates_status, fee_status, scholar_status, current_year, current_semester).
 */
function allFiveStagesCompleted(row) {
  const studentData = parseJSON(row.student_data);

  // Stage 1: Verification — from student_data JSON
  const isStudentVerified = !!studentData.is_student_mobile_verified;
  const isParentVerified = !!studentData.is_parent_mobile_verified;
  const verificationOk = isStudentVerified && isParentVerified;

  // Stage 2: Certificates — from column certificates_status
  const certRaw = (row.certificates_status || '').toLowerCase();
  const certificatesOk = certRaw.includes('verified') || certRaw === 'completed';

  // Stage 3: Fee — from column fee_status
  const feeRaw = (row.fee_status || '').toLowerCase();
  const feeOk = ['no_due', 'nodue', 'no due', 'permitted', 'completed', 'partially_completed', 'partial'].some((s) => feeRaw.includes(s));

  // Stage 4: Promotion — from columns current_year, current_semester
  const promotionOk = !!(row.current_year && String(row.current_year).trim() && row.current_semester && String(row.current_semester).trim());

  // Stage 5: Scholarship — from column scholar_status (any non-empty value = done; empty/null = pending)
  const scholarRaw = (row.scholar_status || '').trim().toLowerCase();
  const scholarshipOk = scholarRaw !== '' && scholarRaw !== 'null' && scholarRaw !== 'undefined';

  return {
    verification: verificationOk,
    certificates: certificatesOk,
    fee: feeOk,
    promotion: promotionOk,
    scholarship: scholarshipOk,
    all: verificationOk && certificatesOk && feeOk && promotionOk && scholarshipOk
  };
}

/**
 * Whether the student is stored as "Completed" (column registration_status or student_data.registration_status).
 */
function isMarkedCompleted(row, hasRegColumn) {
  let status = '';
  if (hasRegColumn && row.registration_status != null && String(row.registration_status).trim() !== '') {
    status = String(row.registration_status).trim();
  }
  if (!status) {
    const data = parseJSON(row.student_data);
    status = (data.registration_status || data['Registration Status'] || '').trim();
  }
  return status.toLowerCase() === 'completed';
}

async function run() {
  const doFix = process.argv.includes('--fix');
  const doFixAll = process.argv.includes('--fix-all');

  console.log('\n=== Registration 5-Stage Audit ===\n');

  const hasRegColumn = await columnExists('registration_status');
  const selectCols = [ // columns needed to evaluate the 5 stages + marked status
    'admission_number',
    'student_name',
    'student_data',
    'certificates_status',
    'fee_status',
    'scholar_status',
    'current_year',
    'current_semester'
  ];
  if (hasRegColumn) selectCols.push('registration_status');

  const [rows] = await masterPool.query(
    `SELECT ${selectCols.join(', ')} FROM students WHERE student_status = 'Regular' ORDER BY admission_number`
  );

  // Classify each student into one of four buckets
  let trulyCompleted = 0;       // all 5 stages + status = Completed
  let falselyCompleted = [];    // status = Completed but not all 5 stages
  let shouldBeCompleted = [];   // all 5 stages but status != Completed
  const stageBreakdown = { verification: 0, certificates: 0, fee: 0, promotion: 0, scholarship: 0 };

  for (const row of rows) {
    const stages = allFiveStagesCompleted(row);
    if (stages.verification) stageBreakdown.verification++;
    if (stages.certificates) stageBreakdown.certificates++;
    if (stages.fee) stageBreakdown.fee++;
    if (stages.promotion) stageBreakdown.promotion++;
    if (stages.scholarship) stageBreakdown.scholarship++;

    const marked = isMarkedCompleted(row, hasRegColumn);

    if (stages.all && marked) {
      trulyCompleted++;
    } else if (marked && !stages.all) {
      falselyCompleted.push({
        admission_number: row.admission_number,
        student_name: row.student_name,
        stages: {
          verification: stages.verification,
          certificates: stages.certificates,
          fee: stages.fee,
          promotion: stages.promotion,
          scholarship: stages.scholarship
        }
      });
    } else if (stages.all && !marked) {
      shouldBeCompleted.push({ admission_number: row.admission_number, student_name: row.student_name });
    }
  }

  const total = rows.length;
  const correctlyPending = total - trulyCompleted - falselyCompleted.length - shouldBeCompleted.length;

  console.log('Summary (Regular students only):');
  console.log('  Total students:', total);
  console.log('  Correctly completed (all 5 stages + marked Completed):', trulyCompleted);
  console.log('  Falsely completed (marked Completed but not all 5 stages):', falselyCompleted.length);
  console.log('  Should be completed (all 5 stages but not marked Completed):', shouldBeCompleted.length);
  console.log('  Correctly pending (not all 5 stages, not marked Completed):', correctlyPending);
  console.log('\nStage-wise count (how many have each stage done):');
  console.log('  Verification:', stageBreakdown.verification);
  console.log('  Certificates:', stageBreakdown.certificates);
  console.log('  Fee:', stageBreakdown.fee);
  console.log('  Promotion:', stageBreakdown.promotion);
  console.log('  Scholarship:', stageBreakdown.scholarship);

  if (falselyCompleted.length > 0) {
    console.log('\n--- Falsely marked as Completed (missing stages) ---');
    falselyCompleted.forEach((s) => {
      const missing = [];
      if (!s.stages.verification) missing.push('Verification');
      if (!s.stages.certificates) missing.push('Certificates');
      if (!s.stages.fee) missing.push('Fee');
      if (!s.stages.promotion) missing.push('Promotion');
      if (!s.stages.scholarship) missing.push('Scholarship');
      console.log(`  ${s.admission_number} | ${s.student_name || 'N/A'} | Missing: ${missing.join(', ')}`);
    });
  }

  if (shouldBeCompleted.length > 0 && shouldBeCompleted.length <= 50) {
    console.log('\n--- Have all 5 stages but not marked Completed (sample) ---');
    shouldBeCompleted.slice(0, 50).forEach((s) => console.log(`  ${s.admission_number} | ${s.student_name || 'N/A'}`));
    if (shouldBeCompleted.length > 50) console.log('  ... and', shouldBeCompleted.length - 50, 'more');
  } else if (shouldBeCompleted.length > 50) {
    console.log('\n--- Have all 5 stages but not marked Completed:', shouldBeCompleted.length, 'students (list omitted) ---');
  }

  const BULK_CHUNK = 500;   // max admission numbers per bulk UPDATE
  const DATA_BATCH = 80;    // batch size for student_data JSON updates
  const CONCURRENCY = 20;    // parallel updates per batch

  // --- Fix: set falsely completed → pending (column + student_data JSON) ---
  if ((doFix || doFixAll) && falselyCompleted.length > 0) {
    console.log('\n--- Fixing falsely completed (setting to pending) ---');
    const falseAdmissions = falselyCompleted.map((s) => s.admission_number);
    if (hasRegColumn) {
      for (let i = 0; i < falseAdmissions.length; i += BULK_CHUNK) {
        const chunk = falseAdmissions.slice(i, i + BULK_CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        await masterPool.query(
          `UPDATE students SET registration_status = 'pending' WHERE admission_number IN (${placeholders})`,
          chunk
        );
      }
      console.log('  Bulk updated registration_status column to pending for', falseAdmissions.length, 'students.');
    }
    for (let i = 0; i < falseAdmissions.length; i += DATA_BATCH) {
      const batch = falseAdmissions.slice(i, i + DATA_BATCH);
      const ph = batch.map(() => '?').join(',');
      const [rows] = await masterPool.query(
        `SELECT admission_number, student_data FROM students WHERE admission_number IN (${ph})`,
        batch
      );
      const updates = rows.map(async (r) => {
        const data = parseJSON(r.student_data);
        data.registration_status = 'pending';
        data['Registration Status'] = 'pending';
        return masterPool.query('UPDATE students SET student_data = ? WHERE admission_number = ?', [
          JSON.stringify(data),
          r.admission_number
        ]);
      });
      for (let j = 0; j < updates.length; j += CONCURRENCY) {
        await Promise.all(updates.slice(j, j + CONCURRENCY));
      }
      console.log('  Updated student_data (pending):', Math.min(i + DATA_BATCH, falseAdmissions.length), '/', falseAdmissions.length);
    }
    console.log('  Done. Set pending for', falseAdmissions.length, 'students.');
  }

  // --- Fix-all: set "should be completed" → Completed (column + student_data JSON) ---
  if (doFixAll && shouldBeCompleted.length > 0) {
    console.log('\n--- Setting Completed for students with all 5 stages ---');
    const completeAdmissions = shouldBeCompleted.map((s) => s.admission_number);
    if (hasRegColumn) {
      const placeholders = completeAdmissions.map(() => '?').join(',');
      await masterPool.query(
        `UPDATE students SET registration_status = 'Completed' WHERE admission_number IN (${placeholders})`,
        completeAdmissions
      );
      console.log('  Bulk updated registration_status column to Completed for', completeAdmissions.length, 'students.');
    }
    const ph = completeAdmissions.map(() => '?').join(',');
    const [rows] = await masterPool.query(
      `SELECT admission_number, student_data FROM students WHERE admission_number IN (${ph})`,
      completeAdmissions
    );
    for (const r of rows) {
      const data = parseJSON(r.student_data);
      data.registration_status = 'Completed';
      data['Registration Status'] = 'Completed';
      await masterPool.query('UPDATE students SET student_data = ? WHERE admission_number = ?', [
        JSON.stringify(data),
        r.admission_number
      ]);
    }
    console.log('  Updated student_data (Completed) for', rows.length, 'students.');
    console.log('  Done. Set Completed for', completeAdmissions.length, 'students.');
  }

  console.log('\n=== End of audit ===\n');
}

run()
  .catch((err) => {
    console.error('Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await masterPool.end();
    } catch (_e) {}
    process.exit(0);
  });
