const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ComplaintCategory = sequelize.define('ComplaintCategory', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    requires_approval: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'complaint_categories',
    timestamps: true,
    underscored: true
});

module.exports = ComplaintCategory;
