const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'office_staff'], // [UPDATED]
    default: 'office_staff',
  },
  college: {
    type: String, // College name for role-based scoping
  },
  permissions: {
    type: [String], // Array of allowed paths (e.g., ['/dashboard', '/students'])
    default: [],
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
