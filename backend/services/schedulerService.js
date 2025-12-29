const cron = require('node-cron');
const { masterPool } = require('../config/database');
const { sendBrevoEmail } = require('../utils/emailService');

// Helper to get today's date in YYYY-MM-DD format (IST)
const getTodayDate = () => {
    const today = new Date();
    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
};

/**
 * Generate Report HTML
 */
const generateReportHtml = (rows, title, attendanceDate) => {
    // Calculate Totals
    let totalStudents = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalHoliday = 0;
    let totalMarked = 0;
    let totalUnmarked = 0;

    const tableRows = rows.map(row => {
        const rowTotal = Number(row.total_students) || 0;
        const rowPresent = Number(row.present) || 0;
        const rowAbsent = Number(row.absent) || 0;
        const rowHoliday = Number(row.holiday) || 0;
        const rowMarked = rowPresent + rowAbsent + rowHoliday;
        const rowUnmarked = Math.max(0, rowTotal - rowMarked);

        totalStudents += rowTotal;
        totalPresent += rowPresent;
        totalAbsent += rowAbsent;
        totalHoliday += rowHoliday;
        totalMarked += rowMarked;
        totalUnmarked += rowUnmarked;

        const timeStamp = row.last_updated
            ? new Date(row.last_updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
            : '-';

        return `
            <tr>
                <td style="padding: 4px; border: 1px solid #ddd;">${row.college || '-'}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${row.batch || '-'}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${row.course || '-'}</td>
                <td style="padding: 4px; border: 1px solid #ddd;">${row.branch || '-'}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${row.year || '-'}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${row.semester || '-'}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${rowTotal}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${rowPresent}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${rowAbsent}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${rowMarked}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${rowUnmarked}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: right;">${rowHoliday}</td>
                <td style="padding: 4px; border: 1px solid #ddd; text-align: center;">${timeStamp}</td>
            </tr>
        `;
    }).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #333; }
                .header { background-color: #f8f9fa; padding: 10px; border-bottom: 2px solid #007bff; margin-bottom: 15px; }
                .title { font-size: 18px; font-weight: bold; color: #007bff; margin: 0; }
                .subtitle { font-size: 12px; color: #666; margin: 5px 0 0; }
                .stats-box { display: flex; gap: 15px; margin-bottom: 15px; background: #e9ecef; padding: 10px; border-radius: 6px; }
                .stat { font-weight: bold; }
                table { width: 100%; border-collapse: collapse; font-size: 11px; }
                th { background-color: #343a40; color: white; padding: 6px; text-align: left; }
                .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="title">${title}</h1>
                <p class="subtitle">Date: ${attendanceDate} | Time: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            </div>

            <div class="stats-box">
                <span class="stat">Total Students: ${totalStudents}</span>
                <span class="stat">Marked: ${totalMarked}</span>
                <span class="stat" style="color: green;">Present: ${totalPresent}</span>
                <span class="stat" style="color: red;">Absent: ${totalAbsent}</span>
                <span class="stat" style="color: orange;">Pending: ${totalUnmarked}</span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 12%;">College</th>
                        <th style="width: 8%;">Batch</th>
                        <th style="width: 15%;">Course</th>
                        <th style="width: 10%;">Branch</th>
                        <th style="width: 5%;">Yr</th>
                        <th style="width: 5%;">Sem</th>
                        <th style="width: 6%; text-align: right;">Total</th>
                        <th style="width: 6%; text-align: right;">Pres</th>
                        <th style="width: 6%; text-align: right;">Abs</th>
                        <th style="width: 6%; text-align: right;">Mkrd</th>
                        <th style="width: 6%; text-align: right;">Pend</th>
                        <th style="width: 6%; text-align: right;">N.C.W</th>
                        <th style="width: 9%; text-align: center;">Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="footer">
                This is an automated report sent at 4:00 PM IST.
            </div>
        </body>
        </html>
    `;
};

/**
 * Send Daily Attendance Reports (Super Admin + AOs)
 * Runs at 4 PM IST
 */
const sendDailyAttendanceReports = async () => {
    try {
        console.log('⏳ Starting Daily Attendance Report generation...');

        const attendanceDate = getTodayDate();
        const SUPER_ADMIN_EMAIL = 'sriram@pydah.edu.in';

        // 1. Fetch Day End Report Data (Grouped Summary)
        const [groupedRows] = await masterPool.query(
            `
              SELECT 
                s.college AS college,
                s.batch AS batch,
                s.course AS course,
                s.branch AS branch,
                s.current_year AS year,
                s.current_semester AS semester,
                COUNT(*) AS total_students,
                SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) AS present,
                SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) AS absent,
                SUM(CASE WHEN ar.status = 'holiday' THEN 1 ELSE 0 END) AS holiday,
                DATE_FORMAT(MAX(ar.updated_at), '%Y-%m-%dT%H:%i:%s+05:30') AS last_updated
              FROM students s
              LEFT JOIN attendance_records ar 
                ON ar.student_id = s.id 
                AND ar.attendance_date = ?
              WHERE s.student_status = 'Regular'
              GROUP BY s.college, s.batch, s.course, s.branch, s.current_year, s.current_semester
              ORDER BY s.college, s.batch, s.course, s.branch, s.current_year, s.current_semester
            `,
            [attendanceDate]
        );

        // 2. Send Super Admin Report (Global)
        const globalHtml = generateReportHtml(groupedRows, 'Day End Attendance Report (Global)', attendanceDate);

        console.log(`📧 Sending Super Admin report to ${SUPER_ADMIN_EMAIL}`);
        const adminEmailResult = await sendBrevoEmail({
            to: SUPER_ADMIN_EMAIL,
            toName: 'Super Admin',
            subject: `Day End Attendance Report (Global) - ${attendanceDate}`,
            htmlContent: globalHtml
        });

        if (adminEmailResult.success) {
            console.log('✅ Super Admin Daily Report email sent successfully.');
        } else {
            console.error('❌ Failed to send Super Admin Daily Report email:', adminEmailResult.message);
        }

        // 3. Send AO Reports (College Specific)
        // Fetch active AOs and their colleges
        const [aos] = await masterPool.query(`
            SELECT u.email, u.name, c.name as college_name 
            FROM rbac_users u 
            JOIN colleges c ON u.college_id = c.id 
            WHERE u.role = 'college_ao' AND u.is_active = 1
        `);

        console.log(`ℹ️ Found ${aos.length} active AOs to notify.`);

        for (const ao of aos) {
            // Filter rows for this AO's college
            const collegeRows = groupedRows.filter(row => row.college === ao.college_name);

            if (collegeRows.length > 0) {
                const collegeHtml = generateReportHtml(collegeRows, `Day End Attendance Report - ${ao.college_name}`, attendanceDate);

                console.log(`📧 Sending AO report to ${ao.email} (${ao.college_name})`);
                await sendBrevoEmail({
                    to: ao.email,
                    toName: ao.name || 'AO',
                    subject: `Day End Attendance Report - ${ao.college_name} - ${attendanceDate}`,
                    htmlContent: collegeHtml
                });
            } else {
                console.log(`⚠️ No data found for AO ${ao.email}'s college (${ao.college_name}), skipping.`);
            }
        }

    } catch (error) {
        console.error('❌ Error generating Daily Attendance Reports:', error);
    }
};

const initScheduledJobs = () => {
    console.log('🕒 Initializing Scheduled Jobs...');

    // Schedule for 4:00 PM IST
    cron.schedule('0 16 * * *', () => {
        console.log('⏰ Triggering 4 PM Scheduled Task...');
        sendDailyAttendanceReports();
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('✅ 4 PM Daily Attendance Report scheduled.');
};

module.exports = {
    initScheduledJobs,
    sendDailyAttendanceReports: sendDailyAttendanceReports // Export for testing
};
