const { masterPool } = require('../config/database');

async function removeAllServices() {
    try {
        console.log('🔄 Removing all services...');

        // First, create a backup
        console.log('📦 Creating backup of services table...');
        await masterPool.execute(`
            CREATE TABLE IF NOT EXISTS services_backup_${Date.now()} AS SELECT * FROM services
        `);
        console.log('✅ Backup created');

        // Delete all service requests first (foreign key constraint)
        const [requests] = await masterPool.execute('SELECT COUNT(*) as count FROM service_requests');
        console.log(`🗑️  Deleting ${requests[0].count} service requests...`);
        await masterPool.execute('DELETE FROM service_requests');
        console.log('✅ Service requests deleted');

        // Delete all services
        const [services] = await masterPool.execute('SELECT COUNT(*) as count FROM services');
        console.log(`🗑️  Deleting ${services[0].count} services...`);
        await masterPool.execute('DELETE FROM services');
        console.log('✅ Services deleted');

        // Reset auto-increment
        await masterPool.execute('ALTER TABLE services AUTO_INCREMENT = 1');
        await masterPool.execute('ALTER TABLE service_requests AUTO_INCREMENT = 1');
        console.log('✅ Auto-increment reset');

        console.log('✅ All services removed successfully!');
        console.log('📝 Note: Backup table created for safety');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error removing services:', error);
        process.exit(1);
    }
}

removeAllServices();
