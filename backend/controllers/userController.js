const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/database');
const {
  AVAILABLE_OPERATIONS,
  normalizeModules,
  parseModules
} = require('../constants/operations');

exports.getAvailableOperations = async (req, res) => {
  res.json({
    success: true,
    data: AVAILABLE_OPERATIONS
  });
};

exports.getStaffUsers = async (req, res) => {
  try {
    const [rows] = await masterPool.query(
      `
        SELECT
          id,
          username,
          email,
          assigned_modules,
          is_active,
          created_at,
          updated_at
        FROM staff_users
        ORDER BY username ASC
      `
    );

    const users = rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      modules: parseModules(row.assigned_modules),
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Failed to fetch staff users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching staff users'
    });
  }
};

exports.createStaffUser = async (req, res) => {
  try {
    const { username, email, password, modules, isActive = true } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    const normalizedModules = normalizeModules(modules);
    if (normalizedModules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one operation must be assigned'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await masterPool.query(
      `
        INSERT INTO staff_users
          (username, email, password_hash, assigned_modules, is_active, created_at, updated_at)
        VALUES (?, ?, ?, CAST(? AS JSON), ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [username.trim(), email.trim(), hashedPassword, JSON.stringify(normalizedModules), isActive ? 1 : 0]
    );

    const [rows] = await masterPool.query(
      `
        SELECT id, username, email, assigned_modules, is_active, created_at, updated_at
        FROM staff_users
        WHERE id = ?
      `,
      [result.insertId]
    );

    const user = rows.length
      ? {
          id: rows[0].id,
          username: rows[0].username,
          email: rows[0].email,
          modules: parseModules(rows[0].assigned_modules),
          isActive: !!rows[0].is_active,
          createdAt: rows[0].created_at,
          updatedAt: rows[0].updated_at
        }
      : null;

    res.status(201).json({
      success: true,
      message: 'Staff user created successfully',
      data: user
    });
  } catch (error) {
    console.error('Failed to create staff user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while creating staff user'
    });
  }
};

exports.updateStaffUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, modules, isActive } = req.body || {};

    const updates = [];
    const params = [];

    if (email) {
      updates.push('email = ?');
      params.push(email.trim());
    }

    if (Array.isArray(modules)) {
      const normalizedModules = normalizeModules(modules);
      if (normalizedModules.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one operation must be assigned'
        });
      }
      updates.push('assigned_modules = CAST(? AS JSON)');
      params.push(JSON.stringify(normalizedModules));
    }

    if (typeof isActive === 'boolean') {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields supplied for update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    params.push(id);

    const [result] = await masterPool.query(
      `
        UPDATE staff_users
        SET ${updates.join(', ')}
        WHERE id = ?
      `,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found'
      });
    }

    const [rows] = await masterPool.query(
      `
        SELECT id, username, email, assigned_modules, is_active, created_at, updated_at
        FROM staff_users
        WHERE id = ?
      `,
      [id]
    );

    const user = rows.length
      ? {
          id: rows[0].id,
          username: rows[0].username,
          email: rows[0].email,
          modules: parseModules(rows[0].assigned_modules),
          isActive: !!rows[0].is_active,
          createdAt: rows[0].created_at,
          updatedAt: rows[0].updated_at
        }
      : null;

    res.json({
      success: true,
      message: 'Staff user updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Failed to update staff user:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while updating staff user'
    });
  }
};

exports.deactivateStaffUser = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await masterPool.query(
      `
        UPDATE staff_users
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff user deactivated successfully'
    });
  } catch (error) {
    console.error('Failed to deactivate staff user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating staff user'
    });
  }
};


