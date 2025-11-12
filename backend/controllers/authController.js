const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const { masterPool } = require('../config/database');
const {
  ALL_OPERATION_KEYS,
  normalizeModules,
  parseModules
} = require('../constants/operations');

const buildAdminResponse = (admin) => ({
  id: admin.id,
  username: admin.username,
  email: admin.email,
  role: 'admin',
  modules: ALL_OPERATION_KEYS
});

const buildStaffResponse = (staffRow) => {
  const modules = normalizeModules(staffRow.assigned_modules);
  const resolvedModules = modules.length > 0 ? modules : ['dashboard'];
  return {
    id: staffRow.id,
    username: staffRow.username,
    email: staffRow.email,
    role: 'staff',
    modules: resolvedModules
  };
};

// Admin or staff login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    let adminAccount = null;
    let supabaseError = null;

    try {
      const { data: admins, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (error) {
        supabaseError = error;
      } else if (admins && admins.length > 0) {
        adminAccount = admins[0];
      }
    } catch (error) {
      supabaseError = error;
    }

    if (adminAccount) {
      const isValidPassword = await bcrypt.compare(password, adminAccount.password);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const tokenPayload = {
        id: adminAccount.id,
        username: adminAccount.username,
        role: 'admin',
        modules: ALL_OPERATION_KEYS
      };

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

      return res.json({
        success: true,
        message: 'Login successful',
        token,
        user: buildAdminResponse(adminAccount)
      });
    }

    // Attempt staff user login if admin not found
    const [staffRows] = await masterPool.query(
      `
        SELECT id, username, email, password_hash, assigned_modules, is_active
        FROM staff_users
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    if (!staffRows || staffRows.length === 0) {
      if (supabaseError) {
        console.error('Admin lookup failed:', supabaseError);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const staffUser = staffRows[0];

    if (!staffUser.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Contact administrator.'
      });
    }

    const validStaffPassword = await bcrypt.compare(password, staffUser.password_hash);

    if (!validStaffPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const staffResponse = buildStaffResponse(staffUser);

    const tokenPayload = {
      id: staffUser.id,
      username: staffUser.username,
      role: 'staff',
      modules: staffResponse.modules
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: staffResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

// Verify token
exports.verifyToken = async (req, res) => {
  try {
    const authUser = req.user || req.admin;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session'
      });
    }

    if (authUser.role === 'staff') {
      const [rows] = await masterPool.query(
        `
          SELECT id, username, email, assigned_modules, is_active
          FROM staff_users
          WHERE id = ?
          LIMIT 1
        `,
        [authUser.id]
      );

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const staffRecord = rows[0];
      if (!staffRecord.is_active) {
        return res.status(403).json({
          success: false,
          message: 'User account is inactive'
        });
      }

      return res.json({
        success: true,
        user: buildStaffResponse(staffRecord)
      });
    }

    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, username, email')
      .eq('id', authUser.id)
      .limit(1);
    if (error) throw error;
    if (!admins || admins.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    res.json({
      success: true,
      user: buildAdminResponse(admins[0])
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during verification' 
    });
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const authUser = req.user || req.admin;
    if (!authUser || authUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can change password via this endpoint'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current and new password are required' 
      });
    }

    // Get admin
    const { data: admins, error: e1 } = await supabase
      .from('admins')
      .select('*')
      .eq('id', authUser.id)
      .limit(1);
    if (e1) throw e1;
    if (!admins || admins.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Admin not found' 
      });
    }

    const admin = admins[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: e2 } = await supabase
      .from('admins')
      .update({ password: hashedPassword })
      .eq('id', authUser.id);
    if (e2) throw e2;

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during password change' 
    });
  }
};
