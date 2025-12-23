const { masterPool } = require('../config/database');

const seedHolidays = async () => {
    try {
        const currentYear = new Date().getFullYear();
        const holidays = [
            { title: 'New Year\'s Day', date: `${currentYear}-01-01` },
            { title: 'Republic Day', date: `${currentYear}-01-26` },
            { title: 'Holi', date: `${currentYear}-03-25` }, // Approximate for 2024
            { title: 'Good Friday', date: `${currentYear}-03-29` }, // Approximate for 2024
            { title: 'Eid al-Fitr', date: `${currentYear}-04-11` }, // Approximate
            { title: 'Independence Day', date: `${currentYear}-08-15` },
            { title: 'Gandhi Jayanti', date: `${currentYear}-10-02` },
            { title: 'Dussehra', date: `${currentYear}-10-12` }, // Approximate
            { title: 'Diwali', date: `${currentYear}-11-01` }, // Approximate
            { title: 'Christmas Day', date: `${currentYear}-12-25` }
        ];

        console.log('Seeding holidays for year:', currentYear);

        for (const holiday of holidays) {
            // Check if exists
            const [existing] = await masterPool.query(
                `SELECT id FROM events WHERE title = ? AND event_date = ? AND event_type = 'holiday'`,
                [holiday.title, holiday.date]
            );

            if (existing.length === 0) {
                await masterPool.query(
                    `INSERT INTO events (title, event_date, event_type, created_by, is_active) 
                     VALUES (?, ?, 'holiday', 1, TRUE)`,
                    [holiday.title, holiday.date]
                );
                console.log(`Added: ${holiday.title}`);
            } else {
                console.log(`Skipped (Exists): ${holiday.title}`);
            }
        }

        console.log('Holiday seeding completed.');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding holidays:', error);
        process.exit(1);
    }
};

seedHolidays();
