const { masterPool } = require('../config/database');
const { USER_ROLES } = require('../constants/rbac');
const { generateAttendanceReportPDF } = require('./pdfService');
const { sendBrevoEmail } = require('../utils/emailService');
const fs = require('fs');

/**
 * Parse scope data (JSON or single value)
 */
const parseScopeData = (data) => {
  if (!data) return [];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [data];
    }
  }
  if (Array.isArray(data)) return data;
  return [data];
};

/**
 * Find HODs and Principals for a given attendance scope
 */
const findNotificationRecipients = async ({
  collegeId,
  courseId,
  branchId,
  year,
  semester
}) => {
  const recipients = {
    hods: [],
    principals: []
  };

  try {
    // Find HODs (branch_hod) - Must have access to college AND course AND branch
    if (collegeId && courseId && branchId) {
      console.log(`🔍 Searching for HODs with College: ${collegeId}, Course: ${courseId}, Branch: ${branchId}`);
      
      const [hodRows] = await masterPool.query(
        `
          SELECT 
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.college_id,
            u.course_id,
            u.branch_id,
            u.college_ids,
            u.course_ids,
            u.branch_ids,
            u.all_courses,
            u.all_branches
          FROM rbac_users u
          WHERE u.role = ?
            AND u.is_active = 1
        `,
        [USER_ROLES.BRANCH_HOD]
      );

      console.log(`   Found ${hodRows.length} HOD(s) in database query`);

      for (const hod of hodRows) {
        const hodCourseIds = parseScopeData(hod.course_ids);
        const hodBranchIds = parseScopeData(hod.branch_ids);
        const hodCollegeIds = parseScopeData(hod.college_ids);
        
        // STRICT CHECK: Must have access to ALL three (college AND course AND branch)
        // Check college access (REQUIRED - no fallback)
        const hasCollegeAccess = hod.college_id === collegeId || 
                                hodCollegeIds.includes(collegeId);
        
        // Check course access (REQUIRED - all_courses flag is acceptable)
        const hasCourseAccess = hod.all_courses || 
                               hod.course_id === courseId || 
                               hodCourseIds.includes(courseId);
        
        // Check branch access (REQUIRED - all_branches flag is acceptable)
        const hasBranchAccess = hod.all_branches || 
                               hod.branch_id === branchId || 
                               hodBranchIds.includes(branchId);

        console.log(`   HOD: ${hod.name} (ID: ${hod.id})`);
        console.log(`     - College: ${hasCollegeAccess ? '✅' : '❌'} (college_id: ${hod.college_id}, college_ids: ${JSON.stringify(hodCollegeIds)})`);
        console.log(`     - Course: ${hasCourseAccess ? '✅' : '❌'} (course_id: ${hod.course_id}, course_ids: ${JSON.stringify(hodCourseIds)}, all_courses: ${hod.all_courses})`);
        console.log(`     - Branch: ${hasBranchAccess ? '✅' : '❌'} (branch_id: ${hod.branch_id}, branch_ids: ${JSON.stringify(hodBranchIds)}, all_branches: ${hod.all_branches})`);

        // ALL THREE must be true (college AND course AND branch)
        if (hasCollegeAccess && hasCourseAccess && hasBranchAccess) {
          recipients.hods.push({
            id: hod.id,
            name: hod.name,
            email: hod.email,
            phone: hod.phone,
            role: hod.role
          });
          console.log(`     ✅ Added HOD: ${hod.name} (${hod.email})`);
        } else {
          console.log(`     ❌ HOD ${hod.name} does not have complete access (College: ${hasCollegeAccess}, Course: ${hasCourseAccess}, Branch: ${hasBranchAccess})`);
        }
      }
    } else {
      console.log(`⚠️ Missing required IDs for HOD lookup - College: ${collegeId}, Course: ${courseId}, Branch: ${branchId}`);
    }

    // Find Principals (college_principal) - Must have access to college AND course AND branch
    // Principals must have access to the specific course and branch, not just the college
    if (collegeId && courseId && branchId) {
      console.log(`🔍 Searching for Principals with College: ${collegeId}, Course: ${courseId}, Branch: ${branchId}`);
      
      const [principalRows] = await masterPool.query(
        `
          SELECT 
            u.id,
            u.name,
            u.email,
            u.phone,
            u.role,
            u.college_id,
            u.course_id,
            u.branch_id,
            u.college_ids,
            u.course_ids,
            u.branch_ids,
            u.all_courses,
            u.all_branches
          FROM rbac_users u
          WHERE u.role = ?
            AND u.is_active = 1
        `,
        [USER_ROLES.COLLEGE_PRINCIPAL]
      );

      console.log(`   Found ${principalRows.length} Principal(s) in database query`);
      
      for (const principal of principalRows) {
        const principalCollegeIds = parseScopeData(principal.college_ids);
        const principalCourseIds = parseScopeData(principal.course_ids);
        const principalBranchIds = parseScopeData(principal.branch_ids);
        
        // STRICT CHECK: Must have access to ALL three (college AND course AND branch)
        // Check college access (REQUIRED)
        const hasCollegeAccess = principal.college_id === collegeId || 
                                principalCollegeIds.includes(collegeId);
        
        // Check course access (REQUIRED - all_courses flag is acceptable for principals)
        const hasCourseAccess = principal.all_courses || 
                                principal.course_id === courseId || 
                                principalCourseIds.includes(courseId);
        
        // Check branch access (REQUIRED - all_branches flag is acceptable for principals)
        const hasBranchAccess = principal.all_branches || 
                               principal.branch_id === branchId || 
                               principalBranchIds.includes(branchId);

        console.log(`   Principal: ${principal.name} (ID: ${principal.id})`);
        console.log(`     - College: ${hasCollegeAccess ? '✅' : '❌'} (college_id: ${principal.college_id}, college_ids: ${JSON.stringify(principalCollegeIds)})`);
        console.log(`     - Course: ${hasCourseAccess ? '✅' : '❌'} (course_id: ${principal.course_id}, course_ids: ${JSON.stringify(principalCourseIds)}, all_courses: ${principal.all_courses})`);
        console.log(`     - Branch: ${hasBranchAccess ? '✅' : '❌'} (branch_id: ${principal.branch_id}, branch_ids: ${JSON.stringify(principalBranchIds)}, all_branches: ${principal.all_branches})`);

        // ALL THREE must be true (college AND course AND branch)
        if (hasCollegeAccess && hasCourseAccess && hasBranchAccess) {
          recipients.principals.push({
            id: principal.id,
            name: principal.name,
            email: principal.email,
            phone: principal.phone,
            role: principal.role
          });
          console.log(`     ✅ Added Principal: ${principal.name} (${principal.email})`);
        } else {
          console.log(`     ❌ Principal ${principal.name} does not have complete access (College: ${hasCollegeAccess}, Course: ${hasCourseAccess}, Branch: ${hasBranchAccess})`);
        }
      }
    } else {
      console.log(`⚠️ Missing required IDs for Principal lookup - College: ${collegeId}, Course: ${courseId}, Branch: ${branchId}`);
    }

    // Log found recipients for debugging
    if (recipients.hods.length > 0 || recipients.principals.length > 0) {
      console.log(`📋 Found recipients - HODs: ${recipients.hods.length}, Principals: ${recipients.principals.length}`);
      recipients.hods.forEach(hod => {
        console.log(`   - HOD: ${hod.name} (${hod.email})`);
      });
      recipients.principals.forEach(principal => {
        console.log(`   - Principal: ${principal.name} (${principal.email})`);
      });
    } else {
      console.log(`⚠️ No recipients found for College: ${collegeId}, Course: ${courseId}, Branch: ${branchId}`);
    }
  } catch (error) {
    console.error('Error finding notification recipients:', error);
  }

  return recipients;
};

/**
 * Send attendance report PDF to HODs and Principals
 */
const sendAttendanceReportNotifications = async ({
  collegeId,
  collegeName,
  courseId,
  courseName,
  branchId,
  branchName,
  batch,
  year,
  semester,
  attendanceDate,
  students,
  attendanceRecords,
  allBatchesData = null // Optional: all batches data for comprehensive report
}) => {
  const results = {
    pdfGenerated: false,
    emailsSent: 0,
    emailsFailed: 0,
    errors: []
  };

  try {
    // Generate PDF
    const pdfPath = await generateAttendanceReportPDF({
      collegeName,
      batch,
      courseName,
      branchName,
      year,
      semester,
      attendanceDate,
      students,
      attendanceRecords,
      allBatchesData // Pass all batches data for tabular format
    });

    results.pdfGenerated = true;

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);

    // Find recipients
    const recipients = await findNotificationRecipients({
      collegeId,
      courseId,
      branchId,
      year,
      semester
    });

    // Combine all recipients - ONLY HODs and Principals
    // Explicitly filter to ensure no students or other roles receive attendance reports
    const allRecipients = [
      ...recipients.hods.filter(r => r.role === USER_ROLES.BRANCH_HOD),
      ...recipients.principals.filter(r => r.role === USER_ROLES.COLLEGE_PRINCIPAL)
    ];

    // Safety check: Ensure no other roles are included
    const invalidRecipients = allRecipients.filter(r => 
      r.role !== USER_ROLES.BRANCH_HOD && r.role !== USER_ROLES.COLLEGE_PRINCIPAL
    );
    
    if (invalidRecipients.length > 0) {
      console.error(`❌ SECURITY: Found invalid recipients for attendance report:`, invalidRecipients);
      // Remove invalid recipients
      const validRecipients = allRecipients.filter(r => 
        r.role === USER_ROLES.BRANCH_HOD || r.role === USER_ROLES.COLLEGE_PRINCIPAL
      );
      console.log(`⚠️ Removed ${invalidRecipients.length} invalid recipient(s), keeping ${validRecipients.length} valid recipient(s)`);
      allRecipients.length = 0;
      allRecipients.push(...validRecipients);
    }

    if (allRecipients.length === 0) {
      console.log(`⚠️ No valid recipients found for attendance notification (College: ${collegeName}, Course: ${courseName}, Branch: ${branchName})`);
      console.log(`   Only HODs and Principals receive attendance report emails.`);
      // Clean up PDF file
      try {
        fs.unlinkSync(pdfPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      return results;
    }

    // Log recipient details for verification
    console.log(`📧 Found ${allRecipients.length} valid recipient(s) for attendance report:`);
    console.log(`   - HODs: ${recipients.hods.length}`);
    console.log(`   - Principals: ${recipients.principals.length}`);
    console.log(`   ✅ All recipients are HODs or Principals only (no students)`);

    // Send email to each recipient
    const emailSubject = `Attendance Report - ${collegeName || 'College'} - ${new Date(attendanceDate).toLocaleDateString('en-IN')}`;
    const emailBody = `
      Dear ${recipients.hods.length > 0 ? 'HOD/Principal' : 'Principal'},

      Please find attached the attendance report for:

      College: ${collegeName || 'N/A'}
      Batch: ${batch || 'N/A'}
      Course: ${courseName || 'N/A'}
      Branch: ${branchName || 'N/A'}
      Year: ${year || 'N/A'}
      Semester: ${semester || 'N/A'}
      Date: ${new Date(attendanceDate).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })}

      The report includes:
      1. Attendance Summary with statistics
      2. Detailed Student List with attendance status

      This is an automated notification from the Student Database Management System.

      Best regards,
      System Administrator
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .info-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #64748b; font-weight: 600; }
          .info-value { color: #1e293b; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Attendance Report</h1>
          </div>
          <div class="content">
            <p>Dear ${recipients.hods.length > 0 ? 'HOD/Principal' : 'Principal'},</p>
            <p>Please find attached the attendance report for:</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">College:</span>
                <span class="info-value">${collegeName || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Batch:</span>
                <span class="info-value">${batch || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Course:</span>
                <span class="info-value">${courseName || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Branch:</span>
                <span class="info-value">${branchName || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Year:</span>
                <span class="info-value">${year || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Semester:</span>
                <span class="info-value">${semester || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Date:</span>
                <span class="info-value">${new Date(attendanceDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}</span>
              </div>
            </div>

            <p>The report includes:</p>
            <ul>
              <li>Attendance Summary with statistics</li>
              <li>Detailed Student List with attendance status</li>
            </ul>

            <p>This is an automated notification from the Student Database Management System.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>System Administrator</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails with PDF attachment - ONLY to HODs and Principals
    for (const recipient of allRecipients) {
      // Double-check: Only send to HODs and Principals
      if (recipient.role !== USER_ROLES.BRANCH_HOD && recipient.role !== USER_ROLES.COLLEGE_PRINCIPAL) {
        console.error(`❌ SECURITY: Skipping email to invalid recipient: ${recipient.name} (${recipient.email}) - Role: ${recipient.role}`);
        results.emailsFailed++;
        results.errors.push(`Invalid recipient role: ${recipient.role} for ${recipient.email}`);
        continue;
      }

      try {
        console.log(`📧 Sending attendance report email to ${recipient.role === USER_ROLES.BRANCH_HOD ? 'HOD' : 'Principal'}: ${recipient.name} (${recipient.email})`);
        
        // Use PDF file path for attachment (email service will read it)
        const emailResult = await sendBrevoEmail({
          to: recipient.email,
          toName: recipient.name,
          subject: emailSubject,
          htmlContent: htmlContent.replace('HOD/Principal', recipient.name),
          attachments: [pdfPath] // Pass file path, email service will read it
        });

        if (emailResult.success) {
          results.emailsSent++;
          console.log(`✅ Attendance report email sent to ${recipient.name} (${recipient.email})`);
        } else {
          results.emailsFailed++;
          results.errors.push(`Failed to send email to ${recipient.email}: ${emailResult.message}`);
          console.error(`❌ Failed to send email to ${recipient.email}:`, emailResult.message);
        }
      } catch (error) {
        results.emailsFailed++;
        results.errors.push(`Error sending email to ${recipient.email}: ${error.message}`);
        console.error(`❌ Error sending email to ${recipient.email}:`, error);
      }
    }

    // Clean up PDF file after sending (with delay to ensure all emails are sent)
    // Keep it for a short time in case of retries, then clean up
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log(`🗑️ Cleaned up PDF file: ${pdfPath}`);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to clean up PDF file ${pdfPath}:`, error.message);
      }
    }, 60000); // Clean up after 60 seconds

  } catch (error) {
    console.error('Error in sendAttendanceReportNotifications:', error);
    results.errors.push(`Error generating/sending attendance report: ${error.message}`);
  }

  return results;
};

module.exports = {
  findNotificationRecipients,
  sendAttendanceReportNotifications
};

