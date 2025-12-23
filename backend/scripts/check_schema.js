const { masterPool } = require('../config/database');

async function checkSchema() {
    try {
        const [services] = await masterPool.execute('DESCRIBE services');
        console.log('Services Table:', services);

        const [requests] = await masterPool.execute('DESCRIBE service_requests');
        console.log('Service Requests Table:', requests);

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

checkSchema();
