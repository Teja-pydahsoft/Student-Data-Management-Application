require('dotenv').config({ path: './backend/.env' });
const { masterPool } = require('../config/database');

async function migrateMembers() {
    try {
        console.log('Starting migration of club members...');

        // 1. Create club_members table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS club_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                club_id INT NOT NULL,
                student_id INT NOT NULL,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                payment_status VARCHAR(50) DEFAULT 'NA',
                fee_type VARCHAR(50) DEFAULT 'Yearly',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                UNIQUE KEY unique_membership (club_id, student_id)
            );
        `;
        await masterPool.query(createTableQuery);
        console.log('Checked/Created club_members table.');

        // 2. Fetch existing clubs
        const [clubs] = await masterPool.query('SELECT id, members FROM clubs');

        for (const club of clubs) {
            let members = [];
            try {
                members = typeof club.members === 'string' ? JSON.parse(club.members) : (club.members || []);
            } catch (e) {
                console.warn(`Failed to parse members for club ${club.id}`);
                continue;
            }

            if (members.length === 0) continue;

            console.log(`Migrating ${members.length} members for club ${club.id}...`);

            for (const member of members) {
                // Ensure student exists (integrity check)
                const [studentCheck] = await masterPool.query('SELECT id FROM students WHERE id = ?', [member.student_id]);
                if (studentCheck.length === 0) {
                    console.warn(`Skipping member check for student ${member.student_id} (not found in students table).`);
                    continue;
                }

                // Insert into club_members
                // Use INSERT IGNORE to skip duplicates if ran multiple times
                const insertQuery = `
                    INSERT IGNORE INTO club_members (club_id, student_id, status, payment_status, fee_type, joined_at)
                    VALUES (?, ?, ?, ?, ?, ?);
                `;

                // Handle joined_at date format or default
                let joinedAt = member.joined_at ? new Date(member.joined_at) : new Date();
                if (isNaN(joinedAt.getTime())) joinedAt = new Date();

                await masterPool.query(insertQuery, [
                    club.id,
                    member.student_id,
                    member.status || 'pending',
                    member.payment_status || 'NA',
                    member.fee_type || 'Yearly',
                    joinedAt
                ]);
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrateMembers();
