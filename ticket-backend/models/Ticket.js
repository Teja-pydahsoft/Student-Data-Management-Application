const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const ComplaintCategory = require('./ComplaintCategory');

const Ticket = sequelize.define('Ticket', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    ticket_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Open', 'In Progress', 'Resolved', 'Closed'),
        defaultValue: 'Open'
    },
    priority: {
        type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
        defaultValue: 'Medium'
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: ComplaintCategory,
            key: 'id'
        }
    },
    student_id: {
        type: DataTypes.STRING, // Storing Admission Number
        allowNull: false
    },
    student_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Assigned staff ID (string from other DB)
    assigned_to: {
        type: DataTypes.STRING,
        allowNull: true
    },
    assigned_to_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_by: {
        type: DataTypes.STRING, // User ID
        allowNull: false
    },
    comments: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    attachments: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    resolved_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'tickets',
    timestamps: true,
    underscored: true
});

// Define Relationships
Ticket.belongsTo(ComplaintCategory, { foreignKey: 'category_id', as: 'category' });
ComplaintCategory.hasMany(Ticket, { foreignKey: 'category_id' });

module.exports = Ticket;
