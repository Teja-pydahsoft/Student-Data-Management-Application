const { masterPool } = require('../config/database');

const updateEnum = async () => {
    try {
        console.log('Updating event_type enum...');
        // We need to redefine the whole enum.
        await masterPool.query("ALTER TABLE events MODIFY COLUMN event_type ENUM('academic', 'holiday', 'exam', 'other', 'event') DEFAULT 'other'");
        console.log('Enum updated successfully.');
    } catch (error) {
        console.error('Failed to update enum:', error);
    } finally {
        process.exit();
    }
};

updateEnum();
