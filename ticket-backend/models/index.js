const { sequelize } = require('../config/database');
const ComplaintCategory = require('./ComplaintCategory');
const Ticket = require('./Ticket');
const Student = require('./Student');

const syncDatabase = async () => {
    try {
        // Use alter: false to prevent modifying the existing student table accidentally
        // or ensure the model matches exactly. 
        // For students, we strictly DON'T want to drop/alter unless necessary.
        await sequelize.sync({ alter: false });
        console.log('Database synced successfully.');
    } catch (error) {
        console.error('Error syncing database:', error);
    }
};

module.exports = {
    sequelize,
    ComplaintCategory,
    Ticket,
    Student,
    syncDatabase
};
