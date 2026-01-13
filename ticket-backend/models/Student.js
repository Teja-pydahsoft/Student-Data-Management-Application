const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Student = sequelize.define('Student', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    admission_number: {
        type: DataTypes.STRING,
        allowNull: true
    },
    student_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    student_photo: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    course: {
        type: DataTypes.STRING,
        allowNull: true
    },
    branch: {
        type: DataTypes.STRING,
        allowNull: true
    },
    current_year: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    current_semester: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'students',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Student;
