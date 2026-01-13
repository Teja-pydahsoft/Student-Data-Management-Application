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
exports.unifiedLogin = async (req, res) => {
    // This is a placeholder. Primarily we rely on SSO from the main app.
    // If we need standalone login, we'd replicate the logic from the main backend here
    // checking both User and Student tables.

    res.status(501).json({
        success: false,
        message: 'Please login via the Main Student Portal or Admin Portal'
    });
};
