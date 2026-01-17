const jwt = require('jsonwebtoken');
const { Student } = require('../models');

// Verify Token & Helper to return user info
exports.verifyToken = async (req, res) => {
    try {
        // req.user is already attached by authMiddleware
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        // Check if user is a student and fetch full details (including photo)
        if (user.role === 'student') {
            try {
                // Try to find student by admission number
                const student = await Student.findOne({
                    where: { admission_number: user.admission_number || user.admissionNumber }
                });

                if (student) {
                    // Merge student data
                    return res.status(200).json({
                        success: true,
                        user: {
                            ...user, // Basic info from token
                            student_photo: student.student_photo,
                            student_name: student.student_name,
                            name: student.student_name || user.name,
                            admission_number: student.admission_number || user.admission_number || user.admissionNumber,
                            course: student.course,
                            branch: student.branch,
                            current_year: student.current_year,
                            current_semester: student.current_semester
                        }
                    });
                }
            } catch (dbError) {
                console.error('Error fetching student details:', dbError);
                // Fallback to token data if DB fetch fails
            }
        }

        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                name: user.name,
                admission_number: user.admission_number,
            }
        });
    } catch (error) {
        console.error('Verify token error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during verification'
        });
    }
};

// Unified Login (Optional fallback if direct login is needed in ticket-app)
// Unified Login
exports.unifiedLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }

        // 1. Check RBAC Users (Managers, Admins, etc.)
        const [rbacUsers] = await require('../config/database').masterPool.query(
            'SELECT id, username, password, role, name, email FROM rbac_users WHERE username = ? AND is_active = 1',
            [username]
        );

        if (rbacUsers.length > 0) {
            const user = rbacUsers[0];
            // Verify password (assuming rbac_users use bcrypt)
            const isMatch = await require('bcryptjs').compare(password, user.password);

            if (isMatch) {
                const token = jwt.sign(
                    { id: user.id, role: user.role, username: user.username },
                    process.env.JWT_SECRET || 'secret_key',
                    { expiresIn: '24h' }
                );

                return res.status(200).json({
                    success: true,
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        name: user.name,
                        email: user.email
                    }
                });
            }
        }

        // 2. Check Ticket Employees (Standalone Workers)
        const [employees] = await require('../config/database').masterPool.query(
            'SELECT id, username, password_hash, role, name, email FROM ticket_employees WHERE username = ? AND is_active = 1',
            [username]
        );

        if (employees.length > 0) {
            const employee = employees[0];
            // Check if this is a standalone worker (role should be worker)
            if (employee.role === 'worker' && employee.password_hash) {
                const isMatch = await require('bcryptjs').compare(password, employee.password_hash);

                if (isMatch) {
                    const token = jwt.sign(
                        { id: employee.id, role: employee.role, username: employee.username, is_worker: true },
                        process.env.JWT_SECRET || 'ticket_app_secret',
                        { expiresIn: '24h' }
                    );

                    return res.status(200).json({
                        success: true,
                        token,
                        user: {
                            id: employee.id,
                            username: employee.username,
                            role: employee.role,
                            name: employee.name,
                            email: employee.email
                        }
                    });
                }
            }
        }

        return res.status(401).json({ success: false, message: 'Invalid credentials' });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
};
