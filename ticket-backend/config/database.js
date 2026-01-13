const mysql = require('mysql2');
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuration for database connection
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'student_database',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+05:30',
    ssl: {
        rejectUnauthorized: false
    }
};

// 1. Raw MySQL2 Pool (Compatible with legacy rbac.js)
// We need this because the shared rbac.js middleware uses 'masterPool.query()'
const masterPoolRaw = mysql.createPool(dbConfig);

masterPoolRaw.on('connection', (connection) => {
    connection.query('SET time_zone = "+05:30"');
});

const masterPool = masterPoolRaw.promise();

// 2. Sequelize Instance (For new Ticket/Task models)
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.user,
    dbConfig.password,
    {
        host: dbConfig.host,
        dialect: 'mysql',
        port: dbConfig.port,
        logging: false, // Set to console.log to see SQL queries
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        timezone: '+05:30',
        dialectOptions: {
            ssl: {
                rejectUnauthorized: false
            }
        }
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Sequelize connection has been established successfully.');
        // Also test raw pool
        const [rows] = await masterPool.query('SELECT 1');
        console.log('Raw MySQL pool connection established successfully.');
        return true;
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        return false;
    }
};

module.exports = {
    sequelize,
    masterPool,
    testConnection
};
