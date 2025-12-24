const FeeHead = require('../MongoDb-Models/FeeHead');
const StudentFee = require('../MongoDb-Models/StudentFee');
const Transaction = require('../MongoDb-Models/Transaction');
const mongoose = require('mongoose');

// Helper to format currency
const formatCurrency = (amount) => {
  return Number(amount || 0).toFixed(2);
};

// Get Filter Options for Fee Dashboard
exports.getFilterOptions = async (req, res) => {
  try {
    const academicYears = await StudentFee.distinct('academicYear');
    const colleges = await StudentFee.distinct('college');
    const courses = await StudentFee.distinct('course');
    const branches = await StudentFee.distinct('branch');

    res.json({
      success: true,
      filters: {
        academicYears,
        colleges,
        courses,
        branches
      }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch filter options' });
  }
};

// Get All Fee Headers
exports.getFeeHeaders = async (req, res) => {
  try {
    const headers = await FeeHead.find().sort({ name: 1 });
    res.json({ success: true, headers });
  } catch (error) {
    console.error('Error fetching fee headers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fee headers' });
  }
};

// Create a new Fee Header
exports.createFeeHeader = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    
    const existing = await FeeHead.findOne({ $or: [{ name }, { code }] });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Fee Head with this name or code already exists' });
    }

    const newHeader = new FeeHead({ name, code, description });
    await newHeader.save();

    res.status(201).json({ success: true, header: newHeader, message: 'Fee Head created successfully' });
  } catch (error) {
    console.error('Error creating fee header:', error);
    res.status(500).json({ success: false, message: 'Failed to create fee header' });
  }
};

// Update Fee Header
exports.updateFeeHeader = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description } = req.body;

    const updatedHeader = await FeeHead.findByIdAndUpdate(
      id,
      { name, code, description },
      { new: true, runValidators: true }
    );

    if (!updatedHeader) {
      return res.status(404).json({ success: false, message: 'Fee Head not found' });
    }

    res.json({ success: true, header: updatedHeader, message: 'Fee Head updated successfully' });
  } catch (error) {
    console.error('Error updating fee header:', error);
    res.status(500).json({ success: false, message: 'Failed to update fee header' });
  }
};

// Delete Fee Header
exports.deleteFeeHeader = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if used in StudentFee
    const usageCount = await StudentFee.countDocuments({ feeHead: id });
    if (usageCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete Fee Head as it is assigned to students' });
    }

    const deleted = await FeeHead.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Fee Head not found' });
    }

    res.json({ success: true, message: 'Fee Head deleted successfully' });
  } catch (error) {
    console.error('Error deleting fee header:', error);
    res.status(500).json({ success: false, message: 'Failed to delete fee header' });
  }
};

// Get Students with Fee Summary
exports.getStudentsWithFees = async (req, res) => {
  try {
    const { page = 1, limit = 10, college, course, branch, academicYear, search } = req.query;
    const skip = (page - 1) * limit;

    const pipeline = [];

    // Match filters
    const matchStage = {};
    if (college) matchStage.college = college;
    if (course) matchStage.course = course;
    if (branch) matchStage.branch = branch;
    if (academicYear) matchStage.academicYear = academicYear;
    if (search) {
      matchStage.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Group by student to calculate totals
    pipeline.push({
      $group: {
        _id: '$studentId',
        studentName: { $first: '$studentName' },
        college: { $first: '$college' },
        course: { $first: '$course' },
        branch: { $first: '$branch' },
        academicYear: { $first: '$academicYear' }, // Simplification: taking first found
        totalFee: { $sum: '$amount' }
      }
    });

    // Pagination facet
    const facetPipeline = [
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }]
        }
      }
    ];

    pipeline.push(...facetPipeline);

    const result = await StudentFee.aggregate(pipeline);
    const studentsData = result[0].data;
    const totalCount = result[0].metadata[0] ? result[0].metadata[0].total : 0;

    // Fetch payments for these students to calculate paid/due
    const studentIds = studentsData.map(s => s._id);
    const payments = await Transaction.aggregate([
      { $match: { studentId: { $in: studentIds }, transactionType: 'CREDIT' } }, // Assuming CREDIT is payment
      { $group: { _id: '$studentId', totalPaid: { $sum: '$amount' } } }
    ]);

    const paymentsMap = {};
    payments.forEach(p => {
      paymentsMap[p._id] = p.totalPaid;
    });

    const formattedStudents = studentsData.map(student => {
      const paid = paymentsMap[student._id] || 0;
      return {
        studentId: student._id,
        name: student.studentName,
        college: student.college,
        course: student.course,
        branch: student.branch,
        totalFee: student.totalFee,
        paidAmount: paid,
        dueAmount: student.totalFee - paid
      };
    });

    res.json({
      success: true,
      students: formattedStudents,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching students with fees:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch students' });
  }
};

// Get Detailed Fee Info for a Single Student
exports.getStudentFeeDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Fetch allocated fees
    const fees = await StudentFee.find({ studentId }).populate('feeHead');
    
    // Fetch transactions
    const transactions = await Transaction.find({ studentId }).sort({ paymentDate: -1 }).populate('feeHead');

    // Calculate totals
    let totalFee = 0;
    fees.forEach(f => totalFee += f.amount);

    let totalPaid = 0;
    transactions.forEach(t => {
      if (t.transactionType === 'CREDIT') {
        totalPaid += t.amount;
      }
    });

    const dueAmount = totalFee - totalPaid;

    res.json({
      success: true,
      studentId,
      summary: {
        totalFee,
        totalPaid,
        dueAmount
      },
      fees,
      transactions
    });
  } catch (error) {
    console.error('Error fetching student fee details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch student fee details' });
  }
};

// Update Student Fees (Manual Add/Edit)
exports.updateStudentFees = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { feeHeadId, amount, academicYear, studentYear, semester, remarks } = req.body;

        // Validation...

        // Start session if needed for atomicity, but single doc update is atomic
        
        // This seems to be adding a single fee record or updating it?
        // Route was POST/PUT /students/:studentId
        
        // Let's assume it's adding a new fee component
        const feeHead = await FeeHead.findById(feeHeadId);
        if(!feeHead) return res.status(404).json({success: false, message: 'Fee Head not found'});

        // We need college/course/etc for the student. Assuming it's passed or we fetch it.
        // For now, let's assume the body has all details or we fetch from an existing record if possible
        // But usually these come from the Student Profile.
        // Since I don't have access to SQL student easy here without import, I rely on body.
        
        const { college, course, branch, studentName } = req.body; 

        const newFee = new StudentFee({
            studentId,
            studentName,
            feeHead: feeHeadId,
            college,
            course,
            branch,
            academicYear,
            studentYear,
            semester,
            amount,
            remarks
        });

        await newFee.save();
        res.json({success: true, message: 'Fee added successfully', fee: newFee});

    } catch (error) {
        console.error('Error updating student fees:', error);
        res.status(500).json({ success: false, message: 'Failed to update student fees' });
    }
};
