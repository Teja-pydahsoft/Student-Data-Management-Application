const mongoose = require('mongoose');

const feeStructureSchema = mongoose.Schema({
  feeHead: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'FeeHead',
  },
  college: {
    type: String,
    required: true,
  },
  course: {
    type: String,
    required: true,
  },
  branch: {
    type: String,
    required: true,
  },
  batch: {
    type: String, // e.g., "2024", "2023-2027"
    required: true,
  },
  studentYear: { 
    type: Number, // e.g., 1, 2, 3, 4
    required: true,
  },
  semester: {
    type: Number, // 1 or 2. If undefined/null, applies to whole year
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
  },
  history: [{
    updatedBy: String,
    updatedAt: { type: Date, default: Date.now },
    changeDescription: String
  }]
}, {
  timestamps: true,
});

// Prevent duplicate fees for the same head/college/course/branch/batch/studentYear/semester
feeStructureSchema.index({ feeHead: 1, college: 1, course: 1, branch: 1, batch: 1, studentYear: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
