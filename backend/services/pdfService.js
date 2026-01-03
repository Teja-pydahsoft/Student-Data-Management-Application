const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { masterPool } = require('../config/database');

const { downloadLogo } = require('./pdf/utils');
const {
  generateStudyCertificate,
  generateRefundApplication,
  generateDynamicCertificate,
  generateCustodianCertificate,
  generateTemplatedCertificate
} = require('./pdf/certificateGenerators');



/**
 * Generate Attendance Report PDF with comprehensive sections:
 * 1. Overall Summary Report
 * 2. Tabular format by Batch/Course/Semester/Year
 * 3. Detailed Student List (optional, excluded when statsOnly is true)
 */
const generateAttendanceReportPDF = async ({
  collegeName,
  batch,
  courseName,
  branchName,
  year,
  semester,
  attendanceDate,
  students,
  attendanceRecords,
  allBatchesData = null, // Optional: all batches data for comprehensive report
  excludeCourse = false, // Optional: exclude course column from tables (for email reports)
  statsOnly = false // Optional: if true, only include stats (exclude detailed student list)
}) => {
  // Filter out cancelled/discontinued/course completed students (already filtered in query, but double-check)
  const validStudents = students.filter(s => {
    const status = s.student_status || (s.student_data && s.student_data['Student Status']);
    // Exclude Course Completed, Discontinued, Admission Cancelled, etc.
    // Only include Regular students
    return status === 'Regular';
  });

  // Separate marked and unmarked students
  const markedStudents = validStudents.filter(s => {
    return attendanceRecords.some(r => r.studentId === s.id);
  });

  const unmarkedStudents = validStudents.filter(s => {
    return !attendanceRecords.some(r => r.studentId === s.id);
  });

  // Create a temporary file path
  const tempDir = os.tmpdir();
  const fileName = `attendance_report_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`;
  const filePath = path.join(tempDir, fileName);

  // Create PDF document with reduced margins for better space utilization
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40
  });

  // Pipe to file
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Helper function to add a new page if needed
  const checkPageBreak = (requiredSpace = 20) => {
    if (doc.y + requiredSpace > doc.page.height - 50) {
      doc.addPage();
      return true;
    }
    return false;
  };

  // ============================================
  // HEADER SECTION: COLLEGE HEADER (Report Style)
  // ============================================
  // Check if we have data from multiple colleges
  // Extract unique colleges from allBatchesData if available
  const uniqueColleges = allBatchesData
    ? [...new Set(allBatchesData.map(b => b.college))].filter(Boolean)
    : (collegeName ? [collegeName] : []);

  const hasMultipleColleges = uniqueColleges.length > 1;
  const isGlobalReport = hasMultipleColleges; // Alias for clarity

  // ============================================
  // HEADER SECTION: COLLEGE HEADER (Report Style)
  // ============================================
  // Fetch college details from database
  let collegeDetails = {
    name: collegeName || (isGlobalReport ? 'Pydah Group of Educational Institutions' : 'College Name'),
    affiliation: isGlobalReport ? 'All Campuses' : 'An Autonomous Institution',
    location: 'Kakinada | Andhra Pradesh | INDIA'
  };

  if (!isGlobalReport && collegeName) {
    try {
      const [collegeRows] = await masterPool.query(
        'SELECT name, metadata FROM colleges WHERE name = ? AND is_active = 1 LIMIT 1',
        [collegeName]
      );
      if (collegeRows && collegeRows.length > 0) {
        const college = collegeRows[0];
        collegeDetails.name = college.name;
        if (college.metadata) {
          const metadata = typeof college.metadata === 'string'
            ? JSON.parse(college.metadata)
            : college.metadata;
          if (metadata.affiliation) collegeDetails.affiliation = metadata.affiliation;
          if (metadata.location) collegeDetails.location = metadata.location;
        }
      }
    } catch (error) {
      console.warn('Could not fetch college details:', error.message);
    }
  }

  const headerTop = 40;
  const pageWidth = doc.page.width;
  const leftMargin = 40;
  const rightMargin = 40;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 515 points

  // Header height - enough for logo + college info + report title
  const headerHeight = 90; // Reduced from 120 for tighter header

  // Logo section (left side) - 80 points wide
  const logoWidth = 80;
  const logoHeight = 80;
  const logoLeft = leftMargin + 10;
  const logoTop = headerTop + 10;

  let logoLoaded = false;
  let tempLogoPath = null;

  // Try to download logo from URL
  try {
    tempLogoPath = await downloadLogo();
    if (fs.existsSync(tempLogoPath)) {
      doc.image(tempLogoPath, logoLeft, logoTop, {
        width: logoWidth,
        height: logoHeight,
        fit: [logoWidth, logoHeight],
        align: 'left'
      });
      logoLoaded = true;
      // Clean up temp file after a short delay
      setTimeout(() => {
        try {
          if (fs.existsSync(tempLogoPath)) {
            fs.unlinkSync(tempLogoPath);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);
    }
  } catch (error) {
    console.warn('Could not download logo from URL:', error.message);
  }

  // Fallback: Try to load logo from public folder
  if (!logoLoaded) {
    const localLogoPath = path.join(process.cwd(), 'frontend', 'public', 'logo.png');
    if (fs.existsSync(localLogoPath)) {
      try {
        doc.image(localLogoPath, logoLeft, logoTop, {
          width: logoWidth,
          height: logoHeight,
          fit: [logoWidth, logoHeight],
          align: 'left'
        });
        logoLoaded = true;
      } catch (error) {
        console.warn('Could not load local logo image:', error.message);
      }
    }
  }

  // If logo still not loaded, create text-based logo placeholder
  if (!logoLoaded) {
    // Draw logo box with rounded corners effect
    doc.rect(logoLeft, logoTop, logoWidth, logoHeight)
      .fillColor('#FF6B35') // Orange
      .fill()
      .strokeColor('#FF6B35')
      .stroke();

    // Add "PYDAH" text in logo box
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#FFFFFF');
    doc.text('PYDAH', logoLeft + 5, logoTop + 20, {
      width: logoWidth - 10,
      align: 'center'
    });

    doc.fontSize(8).font('Helvetica').fillColor('#FFFFFF');
    doc.text('GROUP', logoLeft + 5, logoTop + 45, {
      width: logoWidth - 10,
      align: 'right'
    });

    // Use Helvetica-Oblique for italic text (PDFKit standard font)
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#FFFFFF');
    doc.text('Education & Beyond', logoLeft + 5, logoTop + 60, {
      width: logoWidth - 10,
      align: 'center'
    });
  }

  // College info section (right side)
  const collegeInfoLeft = logoLeft + logoWidth + 20;
  const collegeInfoWidth = contentWidth - logoWidth - 30;

  // College Name (Large, Bold, Dark Gray)
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#1F2937'); // Gray-800
  // Adjust font size for long college names or global report title
  if (collegeDetails.name.length > 30) {
    doc.fontSize(18);
  }
  doc.text(collegeDetails.name, collegeInfoLeft, headerTop + 10, {
    width: collegeInfoWidth,
    align: 'left'
  });

  // Affiliation/Location (Small, Light Gray)
  doc.fontSize(9).font('Helvetica').fillColor('#6B7280'); // Gray-500
  const affiliationText = `${collegeDetails.affiliation} ${collegeDetails.location}`;
  doc.text(affiliationText, collegeInfoLeft, headerTop + 35, {
    width: collegeInfoWidth,
    align: 'left'
  });

  // Report Title (Medium, Bold, Orange)
  const reportMonth = new Date(attendanceDate).toLocaleDateString('en-IN', { month: 'long' });
  const reportYear = new Date(attendanceDate).getFullYear();
  const reportTitle = isGlobalReport
    ? `Global Attendance Summary Report - ${reportMonth} - ${reportYear}`
    : `Attendance Summary Report - ${reportMonth} - ${reportYear}`;

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#FF6B35'); // Orange
  doc.text(reportTitle, collegeInfoLeft, headerTop + 55, {
    width: collegeInfoWidth,
    align: 'left'
  });

  // Date (centered in the middle of the entire page, replacing the subtitle)
  const formattedDate = new Date(attendanceDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  doc.fontSize(11).font('Helvetica').fillColor('#374151'); // Gray-700
  doc.text(`Date: ${formattedDate}`, leftMargin, headerTop + 75, {
    width: contentWidth, // Use full content width for centering
    align: 'center' // Center the date across the entire page
  });

  // Orange border line at bottom of header
  const borderY = headerTop + headerHeight - 2;
  doc.rect(leftMargin, borderY, contentWidth, 2)
    .fillColor('#FF6B35') // Orange
    .fill();

  // Reset color
  doc.fillColor('#000000');
  doc.y = headerTop + headerHeight + 5; // Reduced gap from 15 to 5

  // ============================================
  // SECTION 1: ATTENDANCE SUMMARY REPORT
  // ============================================
  doc.moveDown(0.2); // Reduced from 0.5

  // Summary Information Box with better styling
  const summaryBoxTop = doc.y;
  const summaryBoxHeight = 176; // Increased height to accommodate marked/unmarked stats

  // Box background (light gray)
  doc.rect(leftMargin, summaryBoxTop, contentWidth, summaryBoxHeight)
    .fillColor('#F8FAFC') // Slate-50
    .fill()
    .stroke('#CBD5E1'); // Slate-300 border

  // Section title with background
  doc.rect(leftMargin, summaryBoxTop, contentWidth, 30)
    .fillColor('#1E40AF') // Blue-800
    .fill();

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#FFFFFF');
  doc.text('Summary Information', 60, summaryBoxTop + 8);
  doc.fillColor('#000000');

  doc.fontSize(10).font('Helvetica');
  let yPos = summaryBoxTop + 40;
  const leftCol = 60;
  const rightCol = 320;
  const lineHeight = 18;

  // Left column labels (bold)
  doc.font('Helvetica-Bold');
  doc.text('College:', leftCol, yPos);
  if (!excludeCourse && !isGlobalReport) {
    doc.text('Course:', leftCol, yPos + lineHeight);
  } else if (isGlobalReport) {
    doc.text('Scope:', leftCol, yPos + lineHeight);
  }

  // Adjust line positions based on fields displayed
  let currentYOffset = lineHeight * (isGlobalReport ? 2 : (excludeCourse ? 1 : 2));

  if (!isGlobalReport) {
    doc.text('Branch:', leftCol, yPos + currentYOffset);
    currentYOffset += lineHeight;
  }

  doc.text('Year:', leftCol, yPos + currentYOffset);
  currentYOffset += lineHeight;
  doc.text('Batch:', leftCol, yPos + currentYOffset);

  // Left column values
  doc.font('Helvetica');
  const collegeDisplay = isGlobalReport ? 'All Colleges' : (collegeName || 'N/A');
  doc.text(collegeDisplay, leftCol + 60, yPos, { width: 200, ellipsis: true });

  if (!excludeCourse && !isGlobalReport) {
    doc.text(courseName || 'N/A', leftCol + 60, yPos + lineHeight, { width: 200, ellipsis: true });
  } else if (isGlobalReport) {
    doc.text('All Courses & Branches', leftCol + 60, yPos + lineHeight, { width: 200, ellipsis: true });
  }

  currentYOffset = lineHeight * (isGlobalReport ? 2 : (excludeCourse ? 1 : 2));

  if (!isGlobalReport) {
    // Branch name with proper truncation for long text to prevent alignment issues
    const branchText = branchName || 'N/A';
    const branchY = yPos + currentYOffset;
    // Truncate branch name if too long to prevent overflow
    const maxBranchLength = 50; // Characters before truncation
    const truncatedBranchText = branchText.length > maxBranchLength
      ? branchText.substring(0, maxBranchLength) + '...'
      : branchText;
    doc.text(truncatedBranchText, leftCol + 60, branchY, {
      width: 200,
      ellipsis: false // Already truncated manually
    });
    currentYOffset += lineHeight;
  }

  doc.text(year || 'N/A', leftCol + 60, yPos + currentYOffset, { width: 200, ellipsis: true });
  currentYOffset += lineHeight;
  doc.text(batch || 'N/A', leftCol + 60, yPos + currentYOffset, { width: 200, ellipsis: true });

  // Right column labels (bold)
  doc.font('Helvetica-Bold');
  doc.text('Semester:', rightCol, yPos);
  doc.text('Total Students:', rightCol, yPos + lineHeight);
  doc.text('Marked:', rightCol, yPos + (lineHeight * 2));
  doc.text('Unmarked:', rightCol, yPos + (lineHeight * 3));
  doc.text('Present:', rightCol, yPos + (lineHeight * 4));
  doc.text('Absent:', rightCol, yPos + (lineHeight * 5));
  doc.text('Attendance %:', rightCol, yPos + (lineHeight * 6));

  // Calculate statistics (only for valid students, excluding course completed)
  const totalStudents = validStudents.length;
  const markedCount = markedStudents.length;
  const unmarkedCount = unmarkedStudents.length;
  const presentCount = attendanceRecords.filter(r => {
    const student = validStudents.find(s => s.id === r.studentId);
    return student && r.status === 'present';
  }).length;
  const absentCount = attendanceRecords.filter(r => {
    const student = validStudents.find(s => s.id === r.studentId);
    return student && r.status === 'absent';
  }).length;
  const attendancePercentage = totalStudents > 0
    ? ((presentCount / totalStudents) * 100).toFixed(2) + '%'
    : '0.00%';

  // Calculate Present Percentage based on Total / Absent relationship requested by user
  // "insted of the present show the persentage of the attendance based upon the total / absent"
  // This seems to imply showing the Attendance % AGAIN or emphasizing it. 
  // Standard logic: Present % = (Present / Total) * 100
  // Absent % = (Absent / Total) * 100
  // The user request is slightly ambiguous: "based upon the total / absent which gives the present students percentage"
  // I will replace the raw 'Present' count display with the calculated percentage in the summary section as well, or just keep the Att% at bottom.
  // The user specifically asked to "remove the present column ... and instead show the percentage".
  // This likely applies to the TABLE (checked below), but for this summary box, let's keep it standard but maybe formatted better.

  // Actually, looking at the request "remove the present column for the attendance day end reports and insted of the present show the persentage"
  // This likely refers to the Detailed Table or the Summary Table.
  // In the 'Summary Information' box, we have 'Attendance %' at the bottom already.
  // Let's proceed to the Summary Table (Section 2) for that specific column change.

  // Right column values
  doc.font('Helvetica');
  doc.text(semester || 'N/A', rightCol + 70, yPos);
  doc.text(totalStudents.toString(), rightCol + 70, yPos + lineHeight);
  doc.fillColor('#3B82F6'); // Blue for marked
  doc.text(markedCount.toString(), rightCol + 70, yPos + (lineHeight * 2));
  doc.fillColor('#F59E0B'); // Orange for unmarked
  doc.text(unmarkedCount.toString(), rightCol + 70, yPos + (lineHeight * 3));
  doc.fillColor('#10B981'); // Green for present
  doc.text(presentCount.toString(), rightCol + 70, yPos + (lineHeight * 4));
  doc.fillColor('#EF4444'); // Red for absent
  doc.text(absentCount.toString(), rightCol + 70, yPos + (lineHeight * 5));
  doc.fillColor('#1E40AF'); // Blue for percentage
  doc.font('Helvetica-Bold');
  doc.text(`${attendancePercentage}%`, rightCol + 70, yPos + (lineHeight * 6));
  doc.fillColor('#000000'); // Reset to black
  doc.font('Helvetica');

  doc.y = summaryBoxTop + summaryBoxHeight + 25;
  doc.moveDown(0.5);

  // ============================================
  // SECTION 2: TABULAR FORMAT BY BATCH/COURSE/SEMESTER/YEAR
  // ============================================
  if (allBatchesData && allBatchesData.length > 0) {
    checkPageBreak(60);

    // Section title with background
    const tabularSectionTop = doc.y;
    doc.rect(leftMargin, tabularSectionTop, contentWidth, 30)
      .fillColor('#1E40AF') // Blue-800
      .fill();

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF');
    const tableTitle = isGlobalReport
      ? 'Global Attendance Summary by College/Course'
      : 'Attendance Summary by Batch/Course/Branch/Year/Semester';

    doc.text(tableTitle, leftMargin, tabularSectionTop + 8, {
      width: contentWidth,
      align: 'center'
    });
    doc.fillColor('#000000');

    doc.y = tabularSectionTop + 35;
    doc.moveDown(0.3);

    // Table for batch-wise summary
    const summaryTableTop = doc.y;
    const summaryTableLeft = leftMargin;
    const summaryTableWidth = contentWidth;

    // Adjust column widths based on whether course is excluded AND if we have multiple colleges
    let summaryColWidths;
    let summaryHeaders;

    if (isGlobalReport) {
      // Global Report: Added College Column
      // College, Course, Branch, Year, Sem, Tot, Abs, Att %
      // REMOVED 'Pres' column
      summaryColWidths = [85, 70, 65, 45, 45, 50, 50, 65]; // Re-distributed width
      summaryHeaders = ['College', 'Course', 'Branch', 'Year', 'Sem', 'Total', 'Absent', 'Att %'];
    } else if (excludeCourse) {
      // Batch, Branch, Year, Sem, Total, Absent, Att %
      summaryColWidths = [80, 80, 60, 60, 70, 70, 80];
      summaryHeaders = ['Batch', 'Branch', 'Year', 'Sem', 'Total', 'Absent', 'Att %'];
    } else {
      // Batch, Course, Branch, Year, Sem, Total, Absent, Att %
      summaryColWidths = [70, 90, 70, 55, 55, 55, 55, 65];
      summaryHeaders = ['Batch', 'Course', 'Branch', 'Year', 'Sem', 'Total', 'Absent', 'Att %'];
    }

    const summaryHeaderHeight = 25;
    const summaryRowHeight = 20;

    // Header background
    doc.rect(summaryTableLeft, summaryTableTop, summaryTableWidth, summaryHeaderHeight)
      .fillColor('#1E40AF') // Blue-800
      .fill()
      .stroke('#1E3A8A'); // Blue-900 border

    // Header text
    doc.fontSize(isGlobalReport ? 7 : 8).font('Helvetica-Bold').fillColor('#FFFFFF');
    let summaryXPos = summaryTableLeft + 3;
    summaryHeaders.forEach((header, idx) => {
      doc.text(header, summaryXPos, summaryTableTop + 7);
      summaryXPos += summaryColWidths[idx];
    });
    doc.fillColor('#000000');

    // Table rows for each batch/course/branch/year/semester combination
    let summaryCurrentY = summaryTableTop + summaryHeaderHeight;
    let summaryRowIdx = 0;

    // Sort allBatchesData for consistent display
    const sortedBatches = [...allBatchesData].sort((a, b) => {
      if (a.college !== b.college) return a.college.localeCompare(b.college);
      if (a.course !== b.course) return a.course.localeCompare(b.course);
      if (a.batch !== b.batch) return String(a.batch).localeCompare(String(b.batch));
      if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
      if (a.year !== b.year) return String(a.year).localeCompare(String(b.year));
      return String(a.semester).localeCompare(String(b.semester));
    });

    for (const group of sortedBatches) {
      // Check page break
      if (summaryCurrentY + summaryRowHeight > doc.page.height - 40) {
        doc.addPage();
        summaryCurrentY = 40;
        // Redraw header
        doc.rect(summaryTableLeft, summaryCurrentY, summaryTableWidth, summaryHeaderHeight)
          .fillColor('#1E40AF')
          .fill()
          .stroke('#1E3A8A');
        summaryXPos = summaryTableLeft + 3;
        doc.fontSize(isGlobalReport ? 7 : 8).font('Helvetica-Bold').fillColor('#FFFFFF');
        summaryHeaders.forEach((header, idx) => {
          doc.text(header, summaryXPos, summaryCurrentY + 7);
          summaryXPos += summaryColWidths[idx];
        });
        doc.fillColor('#000000');
        summaryCurrentY += summaryHeaderHeight;
        summaryRowIdx = 0;
      }

      // Alternate row background
      if (summaryRowIdx % 2 === 1) {
        doc.rect(summaryTableLeft, summaryCurrentY, summaryTableWidth, summaryRowHeight)
          .fillColor('#F8FAFC')
          .fill();
      }

      // Row border
      doc.rect(summaryTableLeft, summaryCurrentY, summaryTableWidth, summaryRowHeight)
        .strokeColor('#E2E8F0')
        .stroke();

      // Row data
      doc.fontSize(7).font('Helvetica').fillColor('#000000');
      summaryXPos = summaryTableLeft + 3;

      if (isGlobalReport) {
        // Global Report Columns: College, Course, Branch, Year, Sem, Tot, Pre, Abs, %

        // College - Truncate or map to abbreviation if needed
        let collegeVal = group.college || 'N/A';
        // Simple abbreviations map could be added here if needed
        if (collegeVal.includes('College of Engineering')) collegeVal = collegeVal.replace('College of Engineering', 'COE');
        if (collegeVal.includes('College of Engineering & Technology')) collegeVal = collegeVal.replace('College of Engineering & Technology', 'CET');
        if (collegeVal.includes('Degree College')) collegeVal = collegeVal.replace('Degree College', 'Degree');

        doc.text(collegeVal.substring(0, 20), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[0] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[0];

        // Course
        doc.text(String(group.course || 'N/A').substring(0, 15), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[1] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[1];

        // Branch
        doc.text(String(group.branch || 'N/A').substring(0, 15), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[2] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[2];

        // Year
        doc.text(String(group.year || 'N/A'), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[3] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[3];

        // Semester
        doc.text(String(group.semester || 'N/A'), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[4] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[4];

        // Total
        const totalVal = group.total || group.statistics?.totalStudents || 0;
        doc.text(String(totalVal), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[5] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[5];

        // REMOVED Present Column

        // Absent
        doc.fillColor('#EF4444'); // Red
        const absVal = group.absent || group.statistics?.absentCount || 0;
        doc.text(String(absVal), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[6] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[6];

        // % (Att %)
        doc.fillColor('#1E40AF'); // Blue
        doc.font('Helvetica-Bold');
        const presVal = group.present || group.statistics?.presentCount || 0;
        const attP = totalVal > 0 ? ((presVal / totalVal) * 100).toFixed(1) : '0.0';
        doc.text(`${attP}%`, summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[7] - 3, ellipsis: true });

      } else {
        // Standard Report Logic

        // Batch
        doc.text(String(group.batch || 'N/A').substring(0, 8), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[0] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[0];

        // Course (only if not excluded)
        if (!excludeCourse) {
          doc.text(String(group.course || 'N/A').substring(0, 10), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[1] - 3, ellipsis: true });
          summaryXPos += summaryColWidths[1];
        }

        // Branch
        const branchColIdx = excludeCourse ? 1 : 2;
        doc.text(String(group.branch || 'N/A').substring(0, 8), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[branchColIdx] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[branchColIdx];

        // Year
        const yearColIdx = excludeCourse ? 2 : 3;
        doc.text(String(group.year || 'N/A'), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[yearColIdx] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[yearColIdx];

        // Semester
        const semColIdx = excludeCourse ? 3 : 4;
        doc.text(String(group.semester || 'N/A'), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[semColIdx] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[semColIdx];

        // Total
        const totalColIdx = excludeCourse ? 4 : 5;
        const totalVal = group.total || group.statistics?.totalStudents || 0;
        doc.text(String(totalVal), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[totalColIdx] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[totalColIdx];

        // REMOVED Present Column

        // Absent
        const absentColIdx = excludeCourse ? 5 : 6;
        doc.fillColor('#EF4444'); // Red
        const absVal = group.absent || group.statistics?.absentCount || 0;
        doc.text(String(absVal), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[absentColIdx] - 3, ellipsis: true });
        summaryXPos += summaryColWidths[absentColIdx];

        // Attendance %
        const attPercentColIdx = excludeCourse ? 6 : 7;
        const presentForPercent = group.present || group.statistics?.presentCount || 0;
        const attPercent = totalVal > 0 ? ((presentForPercent / totalVal) * 100).toFixed(1) : '0.0';
        doc.fillColor('#1E40AF'); // Blue
        doc.font('Helvetica-Bold');
        doc.text(`${attPercent}%`, summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[attPercentColIdx] - 3, ellipsis: true });
      }

      doc.font('Helvetica');
      doc.fillColor('#000000'); // Reset to black
      doc.fillColor('#000000');

      summaryCurrentY += summaryRowHeight;
      summaryRowIdx++;
    }

    doc.y = summaryCurrentY + 15;
    doc.moveDown(0.5);
  }

  // ============================================
  // SECTION 3: DETAILED STUDENT LIST (only if statsOnly is false)
  // ============================================
  if (!statsOnly) {
    // Helper function to render student table
    const renderStudentTable = (studentList, sectionTitle, tableTop) => {
      if (studentList.length === 0) return tableTop;

      checkPageBreak(40);

      // Section title with background
      const sectionTitleTop = tableTop;
      doc.rect(leftMargin, sectionTitleTop, contentWidth, 30)
        .fillColor('#1E40AF') // Blue-800
        .fill();

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF');
      doc.text(sectionTitle, leftMargin, sectionTitleTop + 8, {
        width: contentWidth,
        align: 'center'
      });
      doc.fillColor('#000000');

      doc.y = sectionTitleTop + 35;
      doc.moveDown(0.3);

      // Table Header - Adjusted column widths to prevent mobile number merging
      const tableHeaderTop = doc.y;
      const tableLeft = leftMargin;
      const tableWidth = contentWidth; // Use full content width (515 points)
      // Column widths: PIN, Name, Branch, Year+Sem, Student Mobile, Parent Mobile, Status
      // Increased mobile number columns to prevent merging (Total: 45+125+65+50+90+90+50 = 515)
      const colWidths = [45, 125, 65, 50, 90, 90, 50];
      const tableHeaderHeight = 28;
      const rowHeight = 22;

      // Header background with blue color
      doc.rect(tableLeft, tableHeaderTop, tableWidth, tableHeaderHeight)
        .fillColor('#1E40AF') // Blue-800
        .fill()
        .stroke('#1E3A8A'); // Blue-900 border

      // Header text (white on blue background)
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
      const headers = ['PIN', 'Student Name', 'Branch', 'Year+Sem', 'Student Mobile', 'Parent Mobile', 'Status'];
      let xPos = tableLeft + 5;
      headers.forEach((header, index) => {
        doc.text(header, xPos, tableHeaderTop + 8);
        xPos += colWidths[index];
      });
      doc.fillColor('#000000'); // Reset to black

      // Table rows
      let currentY = tableHeaderTop + tableHeaderHeight;
      let rowIndex = 0;

      studentList.forEach((student, index) => {
        // Check if we need a new page
        if (currentY + rowHeight > doc.page.height - 40) {
          doc.addPage();
          // Redraw header on new page
          currentY = 40;
          doc.rect(tableLeft, currentY, tableWidth, tableHeaderHeight)
            .fillColor('#1E40AF') // Blue-800
            .fill()
            .stroke('#1E3A8A'); // Blue-900 border
          xPos = tableLeft + 5;
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF');
          headers.forEach((header, idx) => {
            doc.text(header, xPos, currentY + 8);
            xPos += colWidths[idx];
          });
          doc.fillColor('#000000'); // Reset to black
          currentY += tableHeaderHeight;
          rowIndex = 0;
        }

        // Alternate row background (subtle gray for better readability)
        if (rowIndex % 2 === 1) {
          doc.rect(tableLeft, currentY, tableWidth, rowHeight)
            .fillColor('#F8FAFC') // Slate-50
            .fill();
        }

        // Row border (light gray)
        doc.rect(tableLeft, currentY, tableWidth, rowHeight)
          .strokeColor('#E2E8F0') // Slate-200
          .stroke();

        // Get attendance record for this student
        // For unmarked students table, status is always 'unmarked'
        // For marked students table, get the actual status
        const attendanceRecord = attendanceRecords.find(r => r.studentId === student.id);
        const status = attendanceRecord?.status || 'unmarked';
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);

        // Student data
        const pinNo = student.pin_no ||
          (student.student_data && (student.student_data['PIN Number'] || student.student_data['Pin Number'])) ||
          'N/A';
        const studentName = student.student_name ||
          (student.student_data && (student.student_data['Student Name'] || student.student_data['student_name'])) ||
          'N/A';
        const studentMobile = student.student_mobile ||
          (student.student_data && (student.student_data['Student Mobile Number'] || student.student_data['Student Mobile'] || student.student_data['Student Mobile Number 1'])) ||
          'N/A';
        const parentMobile = student.parent_mobile1 ||
          student.parent_mobile2 ||
          (student.student_data && (student.student_data['Parent Mobile Number 1'] || student.student_data['Parent Phone Number 1'])) ||
          'N/A';
        const yearSem = `${student.current_year || 'N/A'}/${student.current_semester || 'N/A'}`;

        // Cell data
        doc.fontSize(8).font('Helvetica').fillColor('#000000');
        xPos = tableLeft + 5;

        // PIN
        doc.text(pinNo.substring(0, 10), xPos, currentY + 6, { width: colWidths[0] - 5, ellipsis: true });
        xPos += colWidths[0];

        // Student Name
        doc.text(studentName.substring(0, 20), xPos, currentY + 6, { width: colWidths[1] - 5, ellipsis: true });
        xPos += colWidths[1];

        // Branch
        doc.text(branchName?.substring(0, 12) || 'N/A', xPos, currentY + 6, { width: colWidths[2] - 5, ellipsis: true });
        xPos += colWidths[2];

        // Year+Sem
        doc.text(yearSem, xPos, currentY + 6, { width: colWidths[3] - 5, ellipsis: true });
        xPos += colWidths[3];

        // Student Mobile (increased width to prevent merging)
        doc.text(studentMobile.toString().substring(0, 15) || 'N/A', xPos, currentY + 6, { width: colWidths[4] - 8, ellipsis: true });
        xPos += colWidths[4];

        // Parent Mobile (increased width to prevent merging)
        doc.text(parentMobile.toString().substring(0, 15) || 'N/A', xPos, currentY + 6, { width: colWidths[5] - 8, ellipsis: true });
        xPos += colWidths[5];

        // Status (with color and background)
        const statusX = xPos;
        const statusY = currentY + 2;
        const statusWidth = colWidths[6] - 8;
        const statusHeight = rowHeight - 4;

        if (status === 'present') {
          doc.rect(statusX, statusY, statusWidth, statusHeight)
            .fillColor('#D1FAE5') // Green-100 background
            .fill()
            .strokeColor('#10B981'); // Green-500 border
          doc.fillColor('#059669'); // Green-600 text
        } else if (status === 'absent') {
          doc.rect(statusX, statusY, statusWidth, statusHeight)
            .fillColor('#FEE2E2') // Red-100 background
            .fill()
            .strokeColor('#EF4444'); // Red-500 border
          doc.fillColor('#DC2626'); // Red-600 text
        } else {
          doc.rect(statusX, statusY, statusWidth, statusHeight)
            .fillColor('#F3F4F6') // Gray-100 background
            .fill()
            .strokeColor('#6B7280'); // Gray-500 border
          doc.fillColor('#6B7280'); // Gray-600 text
        }
        doc.font('Helvetica-Bold');
        doc.text(statusText, statusX + 2, statusY + 4, { width: statusWidth - 4, ellipsis: true });
        doc.font('Helvetica'); // Reset font
        doc.fillColor('#000000'); // Reset to black

        currentY += rowHeight;
        rowIndex++;
      });

      return currentY + 20; // Return Y position after table with spacing
    };

    // Render marked students table first
    let currentY = doc.y;
    currentY = renderStudentTable(markedStudents, 'Marked Students', currentY);
    doc.y = currentY;
    doc.moveDown(0.5);

    // Render unmarked students table separately
    if (unmarkedStudents.length > 0) {
      checkPageBreak(40);
      currentY = doc.y;
      currentY = renderStudentTable(unmarkedStudents, 'Unmarked Students (Pending)', currentY);
      doc.y = currentY;
    }
  } // End of statsOnly check

  // Footer removed as per request

  // Finalize PDF
  doc.end();

  // Wait for the PDF to be written
  return new Promise((resolve, reject) => {
    stream.on('finish', () => {
      resolve(filePath);
    });
    stream.on('error', (error) => {
      reject(error);
    });
  });
};

/**
 * Generate Study Certificate PDF
 */

// Duplicate certificate functions removed (refactored to ./pdf/certificateGenerators.js)

module.exports = {
  generateAttendanceReportPDF,
  generateStudyCertificate,
  generateRefundApplication,
  generateCustodianCertificate,
  generateDynamicCertificate,
  generateTemplatedCertificate
};

