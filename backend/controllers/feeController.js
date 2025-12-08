const { masterPool } = require('../config/database');
const { getScopeConditionString } = require('../utils/scoping');

/**
 * Get filter options for fee management (similar to attendance filters)
 */
exports.getFilterOptions = async (req, res) => {
  try {
    const { course, branch, batch, year, semester, college } = req.query;
    
    // Build WHERE clause based on applied filters - only regular students
    let whereClause = `WHERE 1=1 AND student_status = 'Regular'`;
    const params = [];
    
    // Apply user scope filtering first
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 'students');
      if (scopeCondition) {
        whereClause += ` AND ${scopeCondition}`;
        params.push(...scopeParams);
      }
    }

    if (college) {
      whereClause += ' AND college = ?';
      params.push(college);
    }

    if (course) {
      whereClause += ' AND course = ?';
      params.push(course);
    }

    if (branch) {
      whereClause += ' AND branch = ?';
      params.push(branch);
    }

    if (batch) {
      whereClause += ' AND batch = ?';
      params.push(batch);
    }

    if (year) {
      const parsedYear = parseInt(year, 10);
      if (!Number.isNaN(parsedYear)) {
        whereClause += ' AND current_year = ?';
        params.push(parsedYear);
      }
    }

    if (semester) {
      const parsedSemester = parseInt(semester, 10);
      if (!Number.isNaN(parsedSemester)) {
        whereClause += ' AND current_semester = ?';
        params.push(parsedSemester);
      }
    }

    // Get unique batches
    const [batchRows] = await masterPool.query(
      `SELECT DISTINCT batch FROM students ${whereClause} AND batch IS NOT NULL AND batch != '' ORDER BY batch DESC`,
      params
    );

    // Get unique years and semesters - if course is selected, use course configuration
    let years = [];
    let semesters = [];
    
    if (course) {
      // Fetch course configuration to get semester structure
      const [courseRows] = await masterPool.query(
        `SELECT total_years, semesters_per_year, year_semester_config 
         FROM courses 
         WHERE name = ? AND is_active = 1 
         LIMIT 1`,
        [course]
      );

      if (courseRows.length > 0) {
        const courseConfig = courseRows[0];
        const totalYears = courseConfig.total_years || 4;
        const defaultSemestersPerYear = courseConfig.semesters_per_year || 2;
        
        // Parse year_semester_config if it exists
        let yearSemesterConfig = null;
        if (courseConfig.year_semester_config) {
          try {
            yearSemesterConfig = typeof courseConfig.year_semester_config === 'string'
              ? JSON.parse(courseConfig.year_semester_config)
              : courseConfig.year_semester_config;
          } catch (e) {
            console.warn('Failed to parse year_semester_config for course:', course, e);
          }
        }

        // Generate years based on course configuration
        for (let year = 1; year <= totalYears; year++) {
          years.push(year);
        }

        // Generate semesters based on course configuration
        // Get all unique semester numbers that exist in the course
        const semesterSet = new Set();
        for (let year = 1; year <= totalYears; year++) {
          let semesterCount = defaultSemestersPerYear;
          
          if (Array.isArray(yearSemesterConfig)) {
            const yearConfig = yearSemesterConfig.find(y => y.year === year);
            if (yearConfig && yearConfig.semesters) {
              semesterCount = yearConfig.semesters;
            }
          }
          
          for (let semester = 1; semester <= semesterCount; semester++) {
            semesterSet.add(semester);
          }
        }
        semesters = Array.from(semesterSet).sort((a, b) => a - b);
      } else {
        // Course not found, fall back to querying students
        const [yearRows] = await masterPool.query(
          `SELECT DISTINCT current_year FROM students ${whereClause} AND current_year IS NOT NULL AND current_year > 0 ORDER BY current_year ASC`,
          params
        );
        const [semesterRows] = await masterPool.query(
          `SELECT DISTINCT current_semester FROM students ${whereClause} AND current_semester IS NOT NULL AND current_semester > 0 ORDER BY current_semester ASC`,
          params
        );
        years = yearRows.map((row) => row.current_year);
        semesters = semesterRows.map((row) => row.current_semester);
      }
    } else {
      // No course selected, get from students table
      const [yearRows] = await masterPool.query(
        `SELECT DISTINCT current_year FROM students ${whereClause} AND current_year IS NOT NULL AND current_year > 0 ORDER BY current_year ASC`,
        params
      );
      const [semesterRows] = await masterPool.query(
        `SELECT DISTINCT current_semester FROM students ${whereClause} AND current_semester IS NOT NULL AND current_semester > 0 ORDER BY current_semester ASC`,
        params
      );
      years = yearRows.map((row) => row.current_year);
      semesters = semesterRows.map((row) => row.current_semester);
    }

    // Get unique courses
    const [courseRows] = await masterPool.query(
      `SELECT DISTINCT course FROM students ${whereClause} AND course IS NOT NULL AND course != '' ORDER BY course ASC`,
      params
    );

    // Get unique branches
    let branchQuery = `SELECT DISTINCT branch FROM students ${whereClause} AND branch IS NOT NULL AND branch != '' ORDER BY branch ASC`;
    if (course) {
      // If course is selected, only show branches for that course
      branchQuery = `SELECT DISTINCT branch FROM students ${whereClause} AND branch IS NOT NULL AND branch != '' ORDER BY branch ASC`;
    }
    const [branchRows] = await masterPool.query(
      branchQuery,
      params
    );

    // Get unique colleges
    const [collegeRows] = await masterPool.query(
      `SELECT DISTINCT college FROM students ${whereClause} AND college IS NOT NULL AND college != '' ORDER BY college ASC`,
      params
    );

    res.json({
      success: true,
      data: {
        batches: batchRows.map((row) => row.batch),
        years: years,
        semesters: semesters,
        courses: courseRows.map((row) => row.course),
        branches: branchRows.map((row) => row.branch),
        colleges: collegeRows.map((row) => row.college)
      }
    });
  } catch (error) {
    console.error('Failed to fetch fee filters:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fee filters'
    });
  }
};

/**
 * Get students with their fee information
 */
exports.getStudentsWithFees = async (req, res) => {
  try {
    const {
      batch,
      currentYear,
      currentSemester,
      studentName,
      parentMobile,
      course,
      branch,
      college,
      feeHeaderId, // New: filter by selected fee header
      limit,
      offset
    } = req.query;

    let query = `
      SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        s.parent_mobile1,
        s.parent_mobile2,
        s.student_photo,
        s.batch,
        s.course,
        s.branch,
        s.college,
        s.current_year,
        s.current_semester,
        s.student_data
      FROM students s
      WHERE 1=1
    `;

    const params = [];

    // Filter for regular students only
    query += ` AND s.student_status = 'Regular'`;

    // Apply user scope filtering
    if (req.userScope) {
      const { scopeCondition, params: scopeParams } = getScopeConditionString(req.userScope, 's');
      if (scopeCondition) {
        query += ` AND ${scopeCondition}`;
        params.push(...scopeParams);
      }
    }

    if (batch) {
      query += ' AND s.batch = ?';
      params.push(batch);
    }

    if (currentYear) {
      const parsedYear = parseInt(currentYear, 10);
      if (!Number.isNaN(parsedYear)) {
        query += ' AND s.current_year = ?';
        params.push(parsedYear);
      }
    }

    if (currentSemester) {
      const parsedSemester = parseInt(currentSemester, 10);
      if (!Number.isNaN(parsedSemester)) {
        query += ' AND s.current_semester = ?';
        params.push(parsedSemester);
      }
    }

    if (course) {
      query += ' AND s.course = ?';
      params.push(course);
    }

    if (branch) {
      query += ' AND s.branch = ?';
      params.push(branch);
    }

    if (college) {
      query += ' AND s.college = ?';
      params.push(college);
    }

    if (studentName) {
      query += ' AND s.student_name LIKE ?';
      params.push(`%${studentName.trim()}%`);
    }

    if (parentMobile) {
      query += ' AND (s.parent_mobile1 LIKE ? OR s.parent_mobile2 LIKE ?)';
      params.push(`%${parentMobile.trim()}%`, `%${parentMobile.trim()}%`);
    }

    // Get all fee headers first (always needed for dropdown)
    const [feeHeaders] = await masterPool.query(
      'SELECT id, header_name, description, is_active FROM fee_headers WHERE is_active = TRUE ORDER BY header_name ASC'
    );

    // Require fee header selection
    if (!feeHeaderId) {
      // Generate year-semester columns based on course configuration if course is selected
      let yearSemColumns = [];
      
      if (course) {
        // Fetch course configuration to get semester structure
        const [courseRows] = await masterPool.query(
          `SELECT total_years, semesters_per_year, year_semester_config 
           FROM courses 
           WHERE name = ? AND is_active = 1 
           LIMIT 1`,
          [course]
        );

        if (courseRows.length > 0) {
          const courseConfig = courseRows[0];
          const totalYears = courseConfig.total_years || 4;
          const defaultSemestersPerYear = courseConfig.semesters_per_year || 2;
          
          // Parse year_semester_config if it exists
          let yearSemesterConfig = null;
          if (courseConfig.year_semester_config) {
            try {
              yearSemesterConfig = typeof courseConfig.year_semester_config === 'string'
                ? JSON.parse(courseConfig.year_semester_config)
                : courseConfig.year_semester_config;
            } catch (e) {
              console.warn('Failed to parse year_semester_config for course:', course, e);
            }
          }

          // Generate columns based on course configuration
          for (let year = 1; year <= totalYears; year++) {
            // Determine how many semesters this year has
            let semesterCount = defaultSemestersPerYear;
            
            if (Array.isArray(yearSemesterConfig)) {
              const yearConfig = yearSemesterConfig.find(y => y.year === year);
              if (yearConfig && yearConfig.semesters) {
                semesterCount = yearConfig.semesters;
              }
            }
            
            // Create columns for each semester in this year
            for (let semester = 1; semester <= semesterCount; semester++) {
              yearSemColumns.push({
                year: year,
                semester: semester,
                key: `Y${year}_S${semester}`,
                label: `Year ${year} Sem ${semester}`
              });
            }
          }
        } else {
          // Course not found, fall back to default logic
          const [yearRows] = await masterPool.query(
            `SELECT DISTINCT current_year 
             FROM students 
             WHERE student_status = 'Regular' 
             AND current_year IS NOT NULL 
             AND current_year > 0
             ORDER BY current_year ASC`
          );
          const [semesterRows] = await masterPool.query(
            `SELECT DISTINCT current_semester 
             FROM students 
             WHERE student_status = 'Regular' 
             AND current_semester IS NOT NULL 
             AND current_semester > 0
             ORDER BY current_semester ASC`
          );
          const years = [...new Set(yearRows.map(row => row.current_year))].sort((a, b) => a - b);
          const semesters = [...new Set(semesterRows.map(row => row.current_semester))].sort((a, b) => a - b);
          const allYears = years.length > 0 ? years : [1, 2, 3, 4];
          const allSemesters = semesters.length > 0 ? semesters : [1, 2];
          
          allYears.forEach(year => {
            allSemesters.forEach(semester => {
              yearSemColumns.push({
                year: year,
                semester: semester,
                key: `Y${year}_S${semester}`,
                label: `Year ${year} Sem ${semester}`
              });
            });
          });
        }
      } else {
        // No course selected, get all unique years and semesters from students
        const [yearRows] = await masterPool.query(
          `SELECT DISTINCT current_year 
           FROM students 
           WHERE student_status = 'Regular' 
           AND current_year IS NOT NULL 
           AND current_year > 0
           ORDER BY current_year ASC`
        );

        const [semesterRows] = await masterPool.query(
          `SELECT DISTINCT current_semester 
           FROM students 
           WHERE student_status = 'Regular' 
           AND current_semester IS NOT NULL 
           AND current_semester > 0
           ORDER BY current_semester ASC`
        );

        // Extract unique years and semesters
        const years = [...new Set(yearRows.map(row => row.current_year))].sort((a, b) => a - b);
        const semesters = [...new Set(semesterRows.map(row => row.current_semester))].sort((a, b) => a - b);

        // If no years or semesters found, use defaults (1-4 years, 1-2 semesters)
        const allYears = years.length > 0 ? years : [1, 2, 3, 4];
        const allSemesters = semesters.length > 0 ? semesters : [1, 2];

        // Generate all possible year-semester combinations (cartesian product)
        allYears.forEach(year => {
          allSemesters.forEach(semester => {
            yearSemColumns.push({
              year: year,
              semester: semester,
              key: `Y${year}_S${semester}`,
              label: `Year ${year} Sem ${semester}`
            });
          });
        });
      }

      return res.json({
        success: true,
        data: {
          students: [],
          totalStudents: 0,
          feeHeaders: feeHeaders.map((h) => ({
            id: h.id,
            headerName: h.header_name,
            description: h.description
          })),
          yearSemColumns
        }
      });
    }

    // Note: We don't filter students by feeHeaderId here
    // The feeHeaderId is only used to determine which fee type to display/edit
    // All students matching the other filters should be shown, even if they don't have fees for this header yet
    const parsedFeeHeaderId = feeHeaderId ? parseInt(feeHeaderId, 10) : null;

    // Get total count before pagination (only if we haven't already returned)
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_query`;
    const [countRows] = await masterPool.query(countQuery, params);
    const totalStudents = countRows[0]?.total || 0;

    // Apply pagination
    if (limit && offset !== undefined) {
      query += ' ORDER BY s.student_name ASC LIMIT ? OFFSET ?';
      params.push(parseInt(limit, 10), parseInt(offset, 10));
    } else {
      query += ' ORDER BY s.student_name ASC';
    }

    const [studentRows] = await masterPool.query(query, params);

    // Get student IDs
    const studentIds = studentRows.map((row) => row.id);

    // Generate year-semester columns based on course configuration if course is selected
    let yearSemColumns = [];
    
    if (course) {
      // Fetch course configuration to get semester structure
      const [courseRows] = await masterPool.query(
        `SELECT total_years, semesters_per_year, year_semester_config 
         FROM courses 
         WHERE name = ? AND is_active = 1 
         LIMIT 1`,
        [course]
      );

      if (courseRows.length > 0) {
        const courseConfig = courseRows[0];
        const totalYears = courseConfig.total_years || 4;
        const defaultSemestersPerYear = courseConfig.semesters_per_year || 2;
        
        // Parse year_semester_config if it exists
        let yearSemesterConfig = null;
        if (courseConfig.year_semester_config) {
          try {
            yearSemesterConfig = typeof courseConfig.year_semester_config === 'string'
              ? JSON.parse(courseConfig.year_semester_config)
              : courseConfig.year_semester_config;
          } catch (e) {
            console.warn('Failed to parse year_semester_config for course:', course, e);
          }
        }

        // Generate columns based on course configuration
        for (let year = 1; year <= totalYears; year++) {
          // Determine how many semesters this year has
          let semesterCount = defaultSemestersPerYear;
          
          if (Array.isArray(yearSemesterConfig)) {
            const yearConfig = yearSemesterConfig.find(y => y.year === year);
            if (yearConfig && yearConfig.semesters) {
              semesterCount = yearConfig.semesters;
            }
          }
          
          // Create columns for each semester in this year
          for (let semester = 1; semester <= semesterCount; semester++) {
            yearSemColumns.push({
              year: year,
              semester: semester,
              key: `Y${year}_S${semester}`,
              label: `Year ${year} Sem ${semester}`
            });
          }
        }
      } else {
        // Course not found, fall back to default logic
        const [yearRows] = await masterPool.query(
          `SELECT DISTINCT current_year 
           FROM students 
           WHERE student_status = 'Regular' 
           AND current_year IS NOT NULL 
           AND current_year > 0
           ORDER BY current_year ASC`
        );
        const [semesterRows] = await masterPool.query(
          `SELECT DISTINCT current_semester 
           FROM students 
           WHERE student_status = 'Regular' 
           AND current_semester IS NOT NULL 
           AND current_semester > 0
           ORDER BY current_semester ASC`
        );
        const years = [...new Set(yearRows.map(row => row.current_year))].sort((a, b) => a - b);
        const semesters = [...new Set(semesterRows.map(row => row.current_semester))].sort((a, b) => a - b);
        const allYears = years.length > 0 ? years : [1, 2, 3, 4];
        const allSemesters = semesters.length > 0 ? semesters : [1, 2];
        
        allYears.forEach(year => {
          allSemesters.forEach(semester => {
            yearSemColumns.push({
              year: year,
              semester: semester,
              key: `Y${year}_S${semester}`,
              label: `Year ${year} Sem ${semester}`
            });
          });
        });
      }
    } else {
      // No course selected, get all unique years and semesters from students
      const [yearRows] = await masterPool.query(
        `SELECT DISTINCT current_year 
         FROM students 
         WHERE student_status = 'Regular' 
         AND current_year IS NOT NULL 
         AND current_year > 0
         ORDER BY current_year ASC`
      );

      const [semesterRows] = await masterPool.query(
        `SELECT DISTINCT current_semester 
         FROM students 
         WHERE student_status = 'Regular' 
         AND current_semester IS NOT NULL 
         AND current_semester > 0
         ORDER BY current_semester ASC`
      );

      // Extract unique years and semesters
      const years = [...new Set(yearRows.map(row => row.current_year))].sort((a, b) => a - b);
      const semesters = [...new Set(semesterRows.map(row => row.current_semester))].sort((a, b) => a - b);

      // If no years or semesters found, use defaults (1-4 years, 1-2 semesters)
      const allYears = years.length > 0 ? years : [1, 2, 3, 4];
      const allSemesters = semesters.length > 0 ? semesters : [1, 2];

      // Generate all possible year-semester combinations (cartesian product)
      allYears.forEach(year => {
        allSemesters.forEach(semester => {
          yearSemColumns.push({
            year: year,
            semester: semester,
            key: `Y${year}_S${semester}`,
            label: `Year ${year} Sem ${semester}`
          });
        });
      });
    }

    // Get fee records for these students - include year and semester info
    let feeRecords = [];
    if (studentIds.length > 0) {
      let feeQuery = `
        SELECT 
          sf.id,
          sf.student_id,
          sf.fee_header_id,
          sf.amount,
          sf.paid_amount,
          sf.due_date,
          sf.payment_date,
          sf.payment_status,
          sf.remarks,
          sf.year,
          sf.semester,
          fh.header_name,
          s.current_year,
          s.current_semester
        FROM student_fees sf
        INNER JOIN fee_headers fh ON sf.fee_header_id = fh.id
        INNER JOIN students s ON sf.student_id = s.id
        WHERE sf.student_id IN (${studentIds.map(() => '?').join(',')})
      `;
      const feeParams = [...studentIds];
      
      // If feeHeaderId is provided, only get fees for that header
      // This filters which fees to fetch, but doesn't filter which students to show
      if (parsedFeeHeaderId && !Number.isNaN(parsedFeeHeaderId)) {
        feeQuery += ' AND sf.fee_header_id = ?';
        feeParams.push(parsedFeeHeaderId);
      }
      
      feeQuery += ' ORDER BY sf.student_id, sf.year, sf.semester';
      
      const [feeRows] = await masterPool.query(feeQuery, feeParams);
      feeRecords = feeRows;
    }

    // Group fees by student_id and year-semester
    const feesByStudent = {};
    feeRecords.forEach((fee) => {
      if (!feesByStudent[fee.student_id]) {
        feesByStudent[fee.student_id] = {};
      }
      // Use the year and semester from the fee record (stored in DB), not student's current year/semester
      const feeYear = fee.year || fee.current_year;
      const feeSemester = fee.semester || fee.current_semester;
      const yearSemKey = `Y${feeYear}_S${feeSemester}`;
      if (!feesByStudent[fee.student_id][yearSemKey]) {
        feesByStudent[fee.student_id][yearSemKey] = {};
      }
      feesByStudent[fee.student_id][yearSemKey][fee.fee_header_id] = {
        id: fee.id,
        feeHeaderId: fee.fee_header_id,
        headerName: fee.header_name,
        amount: parseFloat(fee.amount) || 0,
        paidAmount: parseFloat(fee.paid_amount) || 0,
        dueDate: fee.due_date,
        paymentDate: fee.payment_date,
        paymentStatus: fee.payment_status,
        remarks: fee.remarks,
        year: feeYear,
        semester: feeSemester
      };
    });

    // Combine student data with fees organized by year-semester
    const students = studentRows.map((student) => {
      const studentFees = feesByStudent[student.id] || {};
      const yearSemFeeData = {};

      // Create fee data structure for each year-semester column
      yearSemColumns.forEach((col) => {
        const yearSemFees = studentFees[col.key] || {};
        yearSemFeeData[col.key] = {
          year: col.year,
          semester: col.semester,
          fees: {}
        };

        // Add fee data for the selected header (or all headers if none selected)
        if (parsedFeeHeaderId && !Number.isNaN(parsedFeeHeaderId)) {
          yearSemFeeData[col.key].fees[parsedFeeHeaderId] = yearSemFees[parsedFeeHeaderId] || {
            id: null,
            feeHeaderId: parsedFeeHeaderId,
            amount: 0,
            paidAmount: 0,
            dueDate: null,
            paymentDate: null,
            paymentStatus: 'pending',
            remarks: null,
            year: col.year,
            semester: col.semester
          };
        } else {
          feeHeaders.forEach((header) => {
            yearSemFeeData[col.key].fees[header.id] = yearSemFees[header.id] || {
              id: null,
              feeHeaderId: header.id,
              amount: 0,
              paidAmount: 0,
              dueDate: null,
              paymentDate: null,
              paymentStatus: 'pending',
              remarks: null,
              year: col.year,
              semester: col.semester
            };
          });
        }
      });

      return {
        id: student.id,
        admissionNumber: student.admission_number,
        pinNumber: student.pin_no,
        studentName: student.student_name,
        parentMobile1: student.parent_mobile1,
        parentMobile2: student.parent_mobile2,
        studentPhoto: student.student_photo,
        batch: student.batch,
        course: student.course,
        branch: student.branch,
        college: student.college,
        yearSemFees: yearSemFeeData
      };
    });

    res.json({
      success: true,
      data: {
        students,
        totalStudents,
        feeHeaders: feeHeaders.map((h) => ({
          id: h.id,
          headerName: h.header_name,
          description: h.description
        })),
        yearSemColumns
      }
    });
  } catch (error) {
    console.error('Failed to fetch students with fees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students with fees'
    });
  }
};

/**
 * Get all fee headers
 */
exports.getFeeHeaders = async (req, res) => {
  try {
    const [rows] = await masterPool.query(
      'SELECT id, header_name, description, is_active, created_at, updated_at FROM fee_headers ORDER BY header_name ASC'
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Failed to fetch fee headers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fee headers'
    });
  }
};

/**
 * Create a new fee header
 */
exports.createFeeHeader = async (req, res) => {
  try {
    const { header_name, description, is_active } = req.body;

    if (!header_name || !header_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Fee header name is required'
      });
    }

    const userId = req.admin?.id || req.user?.id || null;

    const [result] = await masterPool.query(
      'INSERT INTO fee_headers (header_name, description, is_active, created_by) VALUES (?, ?, ?, ?)',
      [header_name.trim(), description || null, is_active !== false, userId]
    );

    res.json({
      success: true,
      message: 'Fee header created successfully',
      data: {
        id: result.insertId,
        header_name: header_name.trim(),
        description,
        is_active: is_active !== false
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Fee header with this name already exists'
      });
    }
    console.error('Failed to create fee header:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating fee header'
    });
  }
};

/**
 * Update a fee header
 */
exports.updateFeeHeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { header_name, description, is_active } = req.body;

    if (!header_name || !header_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Fee header name is required'
      });
    }

    const userId = req.admin?.id || req.user?.id || null;

    const [result] = await masterPool.query(
      'UPDATE fee_headers SET header_name = ?, description = ?, is_active = ? WHERE id = ?',
      [header_name.trim(), description || null, is_active !== false, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee header not found'
      });
    }

    res.json({
      success: true,
      message: 'Fee header updated successfully'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Fee header with this name already exists'
      });
    }
    console.error('Failed to update fee header:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating fee header'
    });
  }
};

/**
 * Delete a fee header
 */
exports.deleteFeeHeader = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if there are any student fees using this header
    const [feeRows] = await masterPool.query(
      'SELECT COUNT(*) as count FROM student_fees WHERE fee_header_id = ?',
      [id]
    );

    if (feeRows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete fee header. There are student fees associated with this header. Please deactivate it instead.'
      });
    }

    const [result] = await masterPool.query(
      'DELETE FROM fee_headers WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee header not found'
      });
    }

    res.json({
      success: true,
      message: 'Fee header deleted successfully'
    });
  } catch (error) {
    console.error('Failed to delete fee header:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting fee header'
    });
  }
};

/**
 * Update student fees (bulk update)
 * Now supports year and semester for fee records
 */
exports.updateStudentFees = async (req, res) => {
  const studentId = req.params.studentId || req.body.studentId;
  const { fees, year, semester } = req.body;

  try {
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    if (!Array.isArray(fees)) {
      return res.status(400).json({
        success: false,
        message: 'Fees must be an array'
      });
    }

    const userId = req.admin?.id || req.user?.id || null;
    const connection = await masterPool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Verify student exists and is regular, get current year/semester if not provided
      const [studentRows] = await connection.query(
        'SELECT id, current_year, current_semester FROM students WHERE id = ? AND student_status = "Regular"',
        [studentId]
      );

      if (studentRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Student not found or not a regular student'
        });
      }

      const student = studentRows[0];

      // Process each fee
      for (const fee of fees) {
        const { feeHeaderId, amount, paidAmount, dueDate, paymentDate, paymentStatus, remarks } = fee;

        if (!feeHeaderId) continue;

        // Verify fee header exists
        const [headerRows] = await connection.query(
          'SELECT id FROM fee_headers WHERE id = ? AND is_active = TRUE',
          [feeHeaderId]
        );

        if (headerRows.length === 0) continue;

        const amountValue = parseFloat(amount) || 0;
        const paidAmountValue = parseFloat(paidAmount) || 0;
        const status = paymentStatus || (paidAmountValue >= amountValue ? 'paid' : (paidAmountValue > 0 ? 'partial' : 'pending'));

        // Get year and semester from fee object or use student's current year/semester
        const feeYear = fee.year || year || student.current_year;
        const feeSemester = fee.semester || semester || student.current_semester;

        // Check if fee record exists for this student, header, year, and semester
        const [existingRows] = await connection.query(
          'SELECT id FROM student_fees WHERE student_id = ? AND fee_header_id = ? AND year = ? AND semester = ?',
          [studentId, feeHeaderId, feeYear, feeSemester]
        );

        if (existingRows.length > 0) {
          // Update existing record
          await connection.query(
            `UPDATE student_fees 
             SET amount = ?, paid_amount = ?, due_date = ?, payment_date = ?, payment_status = ?, remarks = ?, updated_by = ?
             WHERE student_id = ? AND fee_header_id = ? AND year = ? AND semester = ?`,
            [
              amountValue,
              paidAmountValue,
              dueDate || null,
              paymentDate || null,
              status,
              remarks || null,
              userId,
              studentId,
              feeHeaderId,
              feeYear,
              feeSemester
            ]
          );
        } else {
          // Insert new record
          await connection.query(
            `INSERT INTO student_fees 
             (student_id, fee_header_id, amount, paid_amount, due_date, payment_date, payment_status, remarks, year, semester, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              studentId,
              feeHeaderId,
              amountValue,
              paidAmountValue,
              dueDate || null,
              paymentDate || null,
              status,
              remarks || null,
              feeYear,
              feeSemester,
              userId,
              userId
            ]
          );
        }
      }

      await connection.commit();

      res.json({
        success: true,
        message: 'Student fees updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Failed to update student fees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating student fees'
    });
  }
};

/**
 * Get complete fee details for a student (all headers, all years/semesters)
 */
exports.getStudentFeeDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required'
      });
    }

    // Get student info
    const [studentRows] = await masterPool.query(
      'SELECT id, student_name, pin_no, batch, course, branch, college, current_year, current_semester FROM students WHERE id = ? AND student_status = "Regular"',
      [studentId]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or not a regular student'
      });
    }

    const student = studentRows[0];

    // Get all active fee headers
    const [feeHeaders] = await masterPool.query(
      'SELECT id, header_name, description FROM fee_headers WHERE is_active = TRUE ORDER BY header_name ASC'
    );

    // Get course configuration for year/semester structure
    let yearSemColumns = [];
    if (student.course) {
      const [courseRows] = await masterPool.query(
        `SELECT total_years, semesters_per_year, year_semester_config
         FROM courses
         WHERE name = ? AND is_active = 1
         LIMIT 1`,
        [student.course]
      );

      if (courseRows.length > 0) {
        const courseConfig = courseRows[0];
        const totalYears = courseConfig.total_years || 4;
        const defaultSemestersPerYear = courseConfig.semesters_per_year || 2;

        let yearSemesterConfig = null;
        if (courseConfig.year_semester_config) {
          try {
            yearSemesterConfig = typeof courseConfig.year_semester_config === 'string'
              ? JSON.parse(courseConfig.year_semester_config)
              : courseConfig.year_semester_config;
          } catch (e) {
            console.warn('Failed to parse year_semester_config:', e);
          }
        }

        for (let year = 1; year <= totalYears; year++) {
          let semesterCount = defaultSemestersPerYear;
          if (Array.isArray(yearSemesterConfig)) {
            const yearConfig = yearSemesterConfig.find(y => y.year === year);
            if (yearConfig && yearConfig.semesters) {
              semesterCount = yearConfig.semesters;
            }
          }
          for (let semester = 1; semester <= semesterCount; semester++) {
            yearSemColumns.push({
              year: year,
              semester: semester,
              key: `Y${year}_S${semester}`,
              label: `Year ${year} Sem ${semester}`
            });
          }
        }
      }
    }

    // If no course config, use defaults
    if (yearSemColumns.length === 0) {
      for (let year = 1; year <= 4; year++) {
        for (let semester = 1; semester <= 2; semester++) {
          yearSemColumns.push({
            year: year,
            semester: semester,
            key: `Y${year}_S${semester}`,
            label: `Year ${year} Sem ${semester}`
          });
        }
      }
    }

    // Get all fee records for this student with year and semester
    const [feeRows] = await masterPool.query(
      `SELECT 
        sf.id,
        sf.fee_header_id,
        sf.amount,
        sf.paid_amount,
        sf.due_date,
        sf.payment_date,
        sf.payment_status,
        sf.remarks,
        sf.year,
        sf.semester,
        fh.header_name
      FROM student_fees sf
      INNER JOIN fee_headers fh ON sf.fee_header_id = fh.id
      WHERE sf.student_id = ?
      ORDER BY sf.fee_header_id, sf.year, sf.semester`,
      [studentId]
    );

    // Organize fees by header and year-semester
    const feesByHeader = {};
    feeHeaders.forEach(header => {
      feesByHeader[header.id] = {
        headerId: header.id,
        headerName: header.header_name,
        description: header.description,
        yearSemFees: {}
      };

      yearSemColumns.forEach(col => {
        // Find matching fee record by fee_header_id, year, AND semester
        const matchingFee = feeRows.find(f => 
          f.fee_header_id === header.id && 
          f.year === col.year && 
          f.semester === col.semester
        );
        if (matchingFee) {
          feesByHeader[header.id].yearSemFees[col.key] = {
            id: matchingFee.id,
            feeHeaderId: header.id,
            year: col.year,
            semester: col.semester,
            amount: parseFloat(matchingFee.amount) || 0,
            paidAmount: parseFloat(matchingFee.paid_amount) || 0,
            dueDate: matchingFee.due_date,
            paymentDate: matchingFee.payment_date,
            paymentStatus: matchingFee.payment_status,
            remarks: matchingFee.remarks
          };
        } else {
          feesByHeader[header.id].yearSemFees[col.key] = {
            feeHeaderId: header.id,
            year: col.year,
            semester: col.semester,
            amount: 0,
            paidAmount: 0,
            dueDate: null,
            paymentDate: null,
            paymentStatus: 'pending',
            remarks: null
          };
        }
      });
    });

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          studentName: student.student_name,
          pinNumber: student.pin_no,
          batch: student.batch,
          course: student.course,
          branch: student.branch,
          college: student.college,
          currentYear: student.current_year,
          currentSemester: student.current_semester
        },
        feeHeaders: feeHeaders.map(h => ({
          id: h.id,
          headerName: h.header_name,
          description: h.description
        })),
        yearSemColumns,
        fees: Object.values(feesByHeader)
      }
    });
  } catch (error) {
    console.error('Failed to get student fee details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student fee details'
    });
  }
};
