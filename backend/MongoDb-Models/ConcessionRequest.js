const mongoose = require('mongoose');

const concessionRequestSchema = mongoose.Schema({
  studentId: {
    type: String, // Admission Number
    required: true,
  },
  studentName: {
    type: String,
  },
  feeHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeHead',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String // S3 URL
  },
  studentYear: {
    type: String, // e.g., "1", "2"
    required: true
  },
  semester: {
    type: String, // e.g., "1", "2"
  },
  college: String,
  course: String,
  branch: String,
  batch: String,
  type: {
    type: String,
    enum: ['Single', 'Bulk'],
    default: 'Single'
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  requestedBy: {
    type: String, // Username
    required: true
  },
  approvedBy: {
    type: String, // Username
  },
  rejectionReason: {
    type: String,
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('ConcessionRequest', concessionRequestSchema);
