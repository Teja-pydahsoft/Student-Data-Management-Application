const { masterPool } = require('../config/database');

/**
 * Migration: Create Custom Roles and Permissions System for Ticket Employees
 * 
 * This migration:
 * 1. Creates ticket_roles table - Stores custom role definitions (Principal, Manager, Worker, etc.)
 * 2. Updates ticket_employees table:
 *    - Changes role from ENUM to VARCHAR to support custom roles
 *    - Adds custom_role_id to link to ticket_roles
 *    - Adds permissions JSON column for user-specific permission overrides
 * 3. Migrates existing 'staff' and 'worker' roles to the new system
 */

async function up() {
    const connection = await masterPool.getConnection();

    try {
        await connection.beginTransaction();

        console.log('Creating ticket_roles table...');

        // Create custom roles table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS ticket_roles (
                id INT PRIMARY KEY AUTO_INCREMENT,
                role_name VARCHAR(100) NOT NULL UNIQUE,
                display_name VARCHAR(150) NOT NULL,
                description TEXT,
                permissions JSON NOT NULL COMMENT 'Granular module permissions: {module: {read, write, update, delete}}',
                is_system_role BOOLEAN DEFAULT FALSE COMMENT 'System roles cannot be deleted',
                is_active BOOLEAN DEFAULT TRUE,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES rbac_users(id) ON DELETE SET NULL,
                INDEX idx_role_name (role_name),
                INDEX idx_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('Inserting default system roles...');

        // Define default role permissions
        const superAdminPermissions = {
            ticket_dashboard: { read: true },
            ticket_management: { read: true, write: true, update: true, delete: true },
            employee_management: { read: true, write: true, update: true, delete: true },
            category_management: { read: true, write: true, update: true, delete: true },
            ticket_reports: { read: true, write: true, update: true, delete: true },
            ticket_settings: { read: true, write: true, update: true, delete: true }
        };

        const adminPermissions = {
            ticket_dashboard: { read: true },
            ticket_management: { read: true, write: true, update: true, delete: true },
            employee_management: { read: true, write: true, update: true, delete: false },
            category_management: { read: true, write: true, update: true, delete: false },
            ticket_reports: { read: true, write: true, update: false, delete: false },
            ticket_settings: { read: true, write: false, update: false, delete: false }
        };

        const managerPermissions = {
            ticket_dashboard: { read: true },
            ticket_management: { read: true, write: true, update: true, delete: false },
            employee_management: { read: true, write: true, update: false, delete: false },
            category_management: { read: true, write: false, update: false, delete: false },
            ticket_reports: { read: true, write: false, update: false, delete: false },
            ticket_settings: { read: false, write: false, update: false, delete: false }
        };

        const workerPermissions = {
            ticket_dashboard: { read: true },
            ticket_management: { read: true, write: false, update: true, delete: false },
            employee_management: { read: false, write: false, update: false, delete: false },
            category_management: { read: true, write: false, update: false, delete: false },
            ticket_reports: { read: false, write: false, update: false, delete: false },
            ticket_settings: { read: false, write: false, update: false, delete: false }
        };

        // Insert default system roles
        const defaultRoles = [
            {
                role_name: 'super_admin',
                display_name: 'Super Administrator',
                description: 'Full system access with all permissions',
                permissions: JSON.stringify(superAdminPermissions),
                is_system_role: true
            },
            {
                role_name: 'admin',
                display_name: 'Administrator',
                description: 'Administrative access with most permissions',
                permissions: JSON.stringify(adminPermissions),
                is_system_role: true
            },
            {
                role_name: 'manager',
                display_name: 'Ticket Manager',
                description: 'Can manage tickets and assign workers',
                permissions: JSON.stringify(managerPermissions),
                is_system_role: true
            },
            {
                role_name: 'staff',
                display_name: 'Staff Member',
                description: 'Staff with ticket management capabilities',
                permissions: JSON.stringify(managerPermissions),
                is_system_role: true
            },
            {
                role_name: 'worker',
                display_name: 'Ticket Worker',
                description: 'Can view and update assigned tickets',
                permissions: JSON.stringify(workerPermissions),
                is_system_role: true
            }
        ];

        for (const role of defaultRoles) {
            await connection.query(
                `INSERT INTO ticket_roles (role_name, display_name, description, permissions, is_system_role)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                    display_name = VALUES(display_name),
                    description = VALUES(description),
                    permissions = VALUES(permissions)`,
                [role.role_name, role.display_name, role.description, role.permissions, role.is_system_role]
            );
        }

        console.log('Updating ticket_employees table structure...');

        // Step 1: Add new columns to ticket_employees
        await connection.query(`
            ALTER TABLE ticket_employees
            ADD COLUMN custom_role_id INT NULL COMMENT 'Reference to ticket_roles table',
            ADD COLUMN role_name VARCHAR(100) NULL COMMENT 'Role name for flexible role assignment',
            ADD COLUMN permissions JSON NULL COMMENT 'User-specific permission overrides',
            ADD CONSTRAINT fk_employee_custom_role 
                FOREIGN KEY (custom_role_id) REFERENCES ticket_roles(id) 
                ON DELETE SET NULL
        `).catch(err => {
            if (err.message.includes('Duplicate')) {
                console.log('Columns already exist, skipping...');
            } else {
                throw err;
            }
        });

        console.log('Migrating existing role data...');

        // Step 2: Populate custom_role_id based on existing ENUM role values
        // Get role IDs
        const [staffRole] = await connection.query(
            `SELECT id FROM ticket_roles WHERE role_name = 'staff' LIMIT 1`
        );
        const [workerRole] = await connection.query(
            `SELECT id FROM ticket_roles WHERE role_name = 'worker' LIMIT 1`
        );

        if (staffRole.length > 0) {
            await connection.query(
                `UPDATE ticket_employees 
                 SET custom_role_id = ?, role_name = 'staff' 
                 WHERE role = 'staff' AND custom_role_id IS NULL`,
                [staffRole[0].id]
            );
            console.log('✓ Migrated staff roles');
        }

        if (workerRole.length > 0) {
            await connection.query(
                `UPDATE ticket_employees 
                 SET custom_role_id = ?, role_name = 'worker' 
                 WHERE role = 'worker' AND custom_role_id IS NULL`,
                [workerRole[0].id]
            );
            console.log('✓ Migrated worker roles');
        }

        // Step 3: Change role column from ENUM to VARCHAR for flexibility
        // Note: We keep the old role column for backward compatibility temporarily
        // In production, you might want to drop it after confirming migration success
        console.log('✓ Role migration completed. Old ENUM role column retained for backward compatibility.');

        await connection.commit();
        console.log('✅ Migration 004 completed successfully!');
        console.log('📝 Note: ticket_employees now supports custom roles via custom_role_id and role_name columns');

    } catch (error) {
        await connection.rollback();
        console.error('❌ Migration 004 failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function down() {
    const connection = await masterPool.getConnection();

    try {
        await connection.beginTransaction();

        console.log('Removing custom role columns from ticket_employees...');
        await connection.query(`
            ALTER TABLE ticket_employees 
            DROP FOREIGN KEY IF EXISTS fk_employee_custom_role,
            DROP COLUMN IF EXISTS custom_role_id,
            DROP COLUMN IF EXISTS role_name,
            DROP COLUMN IF EXISTS permissions
        `);

        console.log('Dropping ticket_roles table...');
        await connection.query(`DROP TABLE IF EXISTS ticket_roles`);

        await connection.commit();
        console.log('✅ Migration 004 rollback completed!');

    } catch (error) {
        await connection.rollback();
        console.error('❌ Migration 004 rollback failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { up, down };

// Run migration if executed directly
if (require.main === module) {
    (async () => {
        try {
            await up();
            process.exit(0);
        } catch (error) {
            console.error('Migration script failed:', error);
            process.exit(1);
        }
    })();
}
