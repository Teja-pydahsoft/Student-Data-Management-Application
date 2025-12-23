const { masterPool } = require('../config/database');

async function migrate() {
    try {
        console.log('Starting migration...');

        // Add template_type to services
        try {
            await masterPool.execute("ALTER TABLE services ADD COLUMN template_type VARCHAR(50) DEFAULT 'standard' AFTER description");
            console.log('Added template_type to services');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('template_type already exists in services');
            else throw e;
        }

        // Add payment_status to service_requests
        try {
            await masterPool.execute("ALTER TABLE service_requests ADD COLUMN payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending' AFTER status");
            console.log('Added payment_status to service_requests');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('payment_status already exists in service_requests');
            else throw e;
        }

        // Add request_data to service_requests
        try {
            await masterPool.execute("ALTER TABLE service_requests ADD COLUMN request_data JSON AFTER service_id");
            console.log('Added request_data to service_requests');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log('request_data already exists in service_requests');
            else throw e;
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
