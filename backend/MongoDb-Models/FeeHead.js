const mongoose = require('mongoose');

const feeHeadSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    unique: true,
    trim: true,
    sparse: true, // Allows null/undefined to not conflict (useful for existing data migration)
  },
  description: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('FeeHead', feeHeadSchema);
