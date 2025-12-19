const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { masterPool } = require('../config/database');

// Logo URL
const LOGO_URL = 'https://static.wixstatic.com/media/bfee2e_7d499a9b2c40442e85bb0fa99e7d5d37~mv2.png/v1/fill/w_162,h_89,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo1.png';

/**
 * Download logo from URL and save to temporary file
 */
const downloadLogo = async () => {
  const tempDir = os.tmpdir();
  const logoPath = path.join(tempDir, `pydah_logo_${Date.now()}.png`);

  return new Promise((resolve, reject) => {
    const url = new URL(LOGO_URL);
    const client = url.protocol === 'https:' ? https : http;

    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download logo: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(logoPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(logoPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(logoPath, () => { }); // Delete file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

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
  // Fetch college details from database
  let collegeDetails = {
    name: collegeName || 'College Name',
    affiliation: 'An Autonomous Institution',
    location: 'Kakinada | Andhra Pradesh | INDIA'
  };

  if (collegeName) {
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
  const headerHeight = 120;

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
  const reportTitle = `Attendance Summary Report - ${reportMonth} - ${reportYear}`;

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
  doc.y = headerTop + headerHeight + 15;

  // ============================================
  // SECTION 1: ATTENDANCE SUMMARY REPORT
  // ============================================
  doc.moveDown(0.5);

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
  if (!excludeCourse) {
    doc.text('Course:', leftCol, yPos + lineHeight);
  }
  doc.text('Branch:', leftCol, yPos + (lineHeight * (excludeCourse ? 1 : 2)));
  doc.text('Year:', leftCol, yPos + (lineHeight * (excludeCourse ? 2 : 3)));
  doc.text('Batch:', leftCol, yPos + (lineHeight * (excludeCourse ? 3 : 4)));

  // Left column values
  doc.font('Helvetica');
  doc.text(collegeName || 'N/A', leftCol + 60, yPos, { width: 200, ellipsis: true });
  if (!excludeCourse) {
    doc.text(courseName || 'N/A', leftCol + 60, yPos + lineHeight, { width: 200, ellipsis: true });
  }
  // Branch name with proper truncation for long text to prevent alignment issues
  const branchText = branchName || 'N/A';
  const branchY = yPos + (lineHeight * (excludeCourse ? 1 : 2));
  // Truncate branch name if too long to prevent overflow
  const maxBranchLength = 50; // Characters before truncation
  const truncatedBranchText = branchText.length > maxBranchLength
    ? branchText.substring(0, maxBranchLength) + '...'
    : branchText;
  doc.text(truncatedBranchText, leftCol + 60, branchY, {
    width: 200,
    ellipsis: false // Already truncated manually
  });
  doc.text(year || 'N/A', leftCol + 60, yPos + (lineHeight * (excludeCourse ? 2 : 3)), { width: 200, ellipsis: true });
  doc.text(batch || 'N/A', leftCol + 60, yPos + (lineHeight * (excludeCourse ? 3 : 4)), { width: 200, ellipsis: true });

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
    ? ((presentCount / totalStudents) * 100).toFixed(2)
    : '0.00';

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
    doc.text('Attendance Summary by Batch/Course/Branch/Year/Semester', leftMargin, tabularSectionTop + 8, {
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
    // Adjust column widths based on whether course is excluded
    const summaryColWidths = excludeCourse
      ? [70, 70, 55, 55, 60, 60, 60, 70] // Batch, Branch, Year, Sem, Total, Present, Absent, Att %
      : [60, 80, 60, 50, 50, 50, 50, 50, 60]; // Batch, Course, Branch, Year, Sem, Total, Present, Absent, %
    const summaryHeaderHeight = 25;
    const summaryRowHeight = 20;

    // Header background
    doc.rect(summaryTableLeft, summaryTableTop, summaryTableWidth, summaryHeaderHeight)
      .fillColor('#1E40AF') // Blue-800
      .fill()
      .stroke('#1E3A8A'); // Blue-900 border

    // Header text
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
    const summaryHeaders = excludeCourse
      ? ['Batch', 'Branch', 'Year', 'Sem', 'Total', 'Present', 'Absent', 'Att %']
      : ['Batch', 'Course', 'Branch', 'Year', 'Sem', 'Total', 'Present', 'Absent', 'Att %'];
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
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF');
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
      doc.text(String(group.total || group.statistics?.totalStudents || 0), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[totalColIdx] - 3, ellipsis: true });
      summaryXPos += summaryColWidths[totalColIdx];

      // Present
      const presentColIdx = excludeCourse ? 5 : 6;
      doc.fillColor('#10B981'); // Green
      doc.text(String(group.present || group.statistics?.presentCount || 0), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[presentColIdx] - 3, ellipsis: true });
      summaryXPos += summaryColWidths[presentColIdx];

      // Absent
      const absentColIdx = excludeCourse ? 6 : 7;
      doc.fillColor('#EF4444'); // Red
      doc.text(String(group.absent || group.statistics?.absentCount || 0), summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[absentColIdx] - 3, ellipsis: true });
      summaryXPos += summaryColWidths[absentColIdx];

      // Attendance %
      const attPercentColIdx = excludeCourse ? 7 : 8;
      const totalForPercent = group.total || group.statistics?.totalStudents || 0;
      const presentForPercent = group.present || group.statistics?.presentCount || 0;
      const attPercent = totalForPercent > 0 ? ((presentForPercent / totalForPercent) * 100).toFixed(1) : '0.0';
      doc.fillColor('#1E40AF'); // Blue
      doc.font('Helvetica-Bold');
      doc.text(`${attPercent}%`, summaryXPos, summaryCurrentY + 5, { width: summaryColWidths[attPercentColIdx] - 3, ellipsis: true });
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

  // Footer with better styling
  const footerY = doc.page.height - 30;
  doc.rect(leftMargin, footerY - 5, contentWidth, 1)
    .fillColor('#E2E8F0') // Slate-200
    .fill();

  doc.fontSize(8).font('Helvetica').fillColor('#64748B'); // Slate-500
  doc.text(
    `Generated on ${new Date().toLocaleString('en-IN')} | Pydah Student Database Management System`,
    leftMargin,
    footerY + 5,
    {
      width: contentWidth,
      align: 'center'
    }
  );

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
// Helper to draw a centered line composed of multiple segments
const drawCenteredLine = (doc, y, segments, pageWidth) => {
  let totalWidth = 0;

  // 1. Calculate Total Width
  segments.forEach(seg => {
    // Ensure text is a string
    const text = (seg.text !== undefined && seg.text !== null) ? String(seg.text) : '';
    seg.safeText = text;

    if (text.length > 0) {
      // Set font to measure width correctly
      doc.font(seg.font || 'Helvetica').fontSize(seg.fontSize || 12);
      const w = doc.widthOfString(text);
      seg.measuredWidth = w; // Store measured width
      totalWidth += w;
    } else {
      seg.measuredWidth = 0;
    }
  });

  // Safety check for NaN
  if (isNaN(totalWidth)) totalWidth = 0;

  // 2. Determine Start X to center the line
  let currentX = (pageWidth - totalWidth) / 2;
  if (isNaN(currentX)) currentX = 0;

  // 3. Draw Segments
  segments.forEach(seg => {
    const text = seg.safeText;
    const width = seg.measuredWidth;

    if (text.length > 0) {
      // Set styling
      doc.font(seg.font || 'Helvetica')
        .fontSize(seg.fontSize || 12)
        .fillColor(seg.color || '#1E40AF'); // Default Blue

      // Draw Text
      doc.text(text, currentX, y, {
        lineBreak: false,
        underline: false // Disable built-in underline to avoid potential internal calc errors
      });

      // Manually Draw Underline if requested
      if (seg.underline) {
        const underlineY = y + (seg.fontSize || 12) + 2; // Approximate baseline offset
        doc.save();
        doc.strokeColor(seg.color || '#000000') // Underline matches text color usually, or black for form fill? 
          .lineWidth(1)
          .moveTo(currentX, underlineY)
          .lineTo(currentX + width, underlineY)
          .stroke();
        doc.restore();
      }

      // Advance X
      currentX += width;
    }
  });
};

/**
 * Generate Study Certificate PDF
 */
const generateStudyCertificate = async (student, request, collegeDetails) => {
  const tempDir = os.tmpdir();
  const fileName = `study_certificate_${student.admission_number}_${Date.now()}.pdf`;
  const filePath = path.join(tempDir, fileName);

  const doc = new PDFDocument({
    size: 'A5', // A5 as requested
    layout: 'landscape',
    margin: 40 // Reduced margin for A5
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // --- Header ---
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 80;

  // LOGO
  const logoPath = path.join(__dirname, '../../frontend/public/logo.png');
  const logoWidth = 90;
  const logoX = pageWidth - 130;  // Right side

  // Moved logo down to 50 to avoid overlap with College Name
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, logoX, 50, { width: logoWidth });
  }

  // Address logo overlap by adjusting text wrapping or width if needed, but moving logo is safer.

  // College Name
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#1E40AF'); // Royal Blue
  // Center roughly, accounting for logo push if needed, but header is usually centered on page
  doc.text((collegeDetails.name || 'PYDAH COLLEGE OF ENGINEERING').toUpperCase(), 40, 30, { align: 'center', width: contentWidth });

  // Subtitle/Address
  doc.font('Helvetica').fontSize(10).fillColor('#1E40AF'); // Keeping it Blue as per photo
  doc.text('(Approved by AICTE & Affiliated to JNT University, Kakinada)', 40, 58, { align: 'center', width: contentWidth });
  doc.text('Yanam Road, Patavala, KAKINADA-533 461, E.G.DT.', 40, 72, { align: 'center', width: contentWidth });

  // Phone/Website
  doc.text(`Ph: ${collegeDetails.phone || '0884-2315333'}   Website : ${collegeDetails.website || 'www.pydah.edu.in'}`, 40, 86, { align: 'center', width: contentWidth });

  // Line separator
  doc.moveTo(30, 105).lineTo(pageWidth - 30, 105).strokeColor('#1E40AF').lineWidth(1.5).stroke();

  // Date
  const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1E40AF');
  doc.text('Date:', pageWidth - 160, 115, { continued: true });
  doc.font('Helvetica').text(` ${today}`, { underline: false });

  // --- Title ---
  doc.moveDown(2); // roughly y=140
  const titleY = 145;
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1E40AF');
  // Draw text with underline manually to control style better or use option
  const title = 'STUDY CERTIFICATE';
  const titleWidth = doc.widthOfString(title);
  doc.text(title, (pageWidth - titleWidth) / 2, titleY, { underline: true });

  // --- Body ---
  // Ensure request_data is parsed
  let requestData = request.request_data;
  if (typeof requestData === 'string') {
    try { requestData = JSON.parse(requestData); } catch (e) { requestData = {}; }
  } else if (!requestData) {
    requestData = {};
  }

  // Data Preparation with padding for "blank line" look
  const pad = (str) => `  ${str}  `;

  // Helper to format name: First Full, Middles Initialized, Last Full. 
  // User req: "first word and last word needed to be shown and the remaining words are neede to be shown with the capital letters with the ."
  // Actually commonly: "Surname F. M." or "First M. Last". 
  // Interpreting strictly: "Word1" + initials + "WordN"
  const formatName = (fullName) => {
    if (!fullName) return '________________';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName;

    // First word full
    let formatted = parts[0];
    // Middle words initials
    for (let i = 1; i < parts.length - 1; i++) {
      formatted += ` ${parts[i].charAt(0).toUpperCase()}.`;
    }
    // Last word full
    formatted += ` ${parts[parts.length - 1]}`;
    return formatted;
  };

  const studentNameInput = student.student_name || '________________';
  const studentName = formatName(studentNameInput).toUpperCase();

  const parentName = (student.father_name || student.guardian_name || '________________').toUpperCase();
  // Ensure admission number is used for PIN
  const pinNo = (student.admission_number || '________________').toUpperCase();
  const year = student.current_year ? student.current_year.toString() : '__';
  const sem = student.current_semester ? student.current_semester.toString() : '__';
  const course = (student.course || 'B.Tech').toUpperCase();
  const branch = (student.branch || '________________________').toUpperCase();

  // Calculate Academic Year (e.g., if 2024, then 2024-2025)
  // Use student data or current date fallback
  let academicYear = student.academic_year;
  if (!academicYear) {
    const currentMonth = new Date().getMonth(); // 0-11
    const currentYr = new Date().getFullYear();
    if (currentMonth < 5) academicYear = `${currentYr - 1}-${currentYr}`;
    else academicYear = `${currentYr}-${currentYr + 1}`;
  }

  const purpose = (requestData.purpose || '__________________________________');

  // Font Config
  const bodyFont = 'Helvetica-Bold';
  const bodySize = 13;
  const dataFont = 'Helvetica-Bold';
  const dataSize = 13;
  const baseColor = '#1E40AF'; // Blue
  const dataColor = '#000000'; // Black for filled data

  let startY = 190;
  const lineHeight = 30; // Increased spacing

  // Line 1: This is to certify that Mr./Ms. [Name] (PIN No. [Pin])
  drawCenteredLine(doc, startY, [
    { text: 'This is to certify that Mr./Ms. ', font: 'Helvetica', color: baseColor },
    { text: pad(studentName), font: dataFont, color: dataColor, underline: true },
    { text: ' (PIN No. ', font: 'Helvetica', color: baseColor },
    { text: pad(pinNo), font: dataFont, color: dataColor, underline: true },
    { text: ')', font: 'Helvetica', color: baseColor }
  ], pageWidth);

  // Line 2: S/o, D/o of Sri [Parent] is studying [Year] year [Sem] sem in [Course]
  drawCenteredLine(doc, startY + lineHeight, [
    { text: 'S/o, D/o of Sri ', font: 'Helvetica', color: baseColor },
    { text: pad(parentName), font: dataFont, color: dataColor, underline: true },
    { text: ' is studying ', font: 'Helvetica', color: baseColor },
    { text: pad(year), font: dataFont, color: dataColor, underline: true },
    { text: ' year ', font: 'Helvetica', color: baseColor },
    { text: pad(sem), font: dataFont, color: dataColor, underline: true },
    { text: ' sem in ', font: 'Helvetica', color: baseColor },
    { text: course, font: dataFont, color: dataColor, underline: true }
  ], pageWidth);

  // Line 3: [Branch] Branch during the academic Year [AcadYear] in our college. This is being issued for the
  drawCenteredLine(doc, startY + lineHeight * 2, [
    { text: pad(branch), font: dataFont, color: dataColor, underline: true },
    { text: ' Branch during the academic Year ', font: 'Helvetica', color: baseColor },
    { text: pad(academicYear), font: dataFont, color: dataColor, underline: true },
    { text: ' in our college. This is being issued for the', font: 'Helvetica', color: baseColor }
  ], pageWidth);

  // Line 4: purpose of getting [Purpose] only.
  drawCenteredLine(doc, startY + lineHeight * 3, [
    { text: 'purpose of getting ', font: 'Helvetica', color: baseColor },
    { text: pad(purpose), font: dataFont, color: dataColor, underline: true },
    { text: ' only.', font: 'Helvetica', color: baseColor }
  ], pageWidth);


  // --- Footer ---
  const footerY = doc.page.height - 80;

  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1E40AF');
  doc.text('Seal :', 60, footerY);
  doc.text('PRINCIPAL', pageWidth - 160, footerY);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

module.exports = {
  generateAttendanceReportPDF,
  generateStudyCertificate
};

