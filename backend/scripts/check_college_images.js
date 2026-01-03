const { masterPool } = require('../config/database');

async function checkCollegeImages() {
    try {
        console.log('🔍 Checking college images in database...\n');

        const [colleges] = await masterPool.execute(`
            SELECT 
                id, 
                name,
                CASE WHEN header_image IS NOT NULL THEN 'YES' ELSE 'NO' END as has_header,
                CASE WHEN footer_image IS NOT NULL THEN 'YES' ELSE 'NO' END as has_footer,
                header_image_type,
                footer_image_type,
                CASE WHEN header_image IS NOT NULL THEN LENGTH(header_image) ELSE 0 END as header_size,
                CASE WHEN footer_image IS NOT NULL THEN LENGTH(footer_image) ELSE 0 END as footer_size
            FROM colleges
            ORDER BY name
        `);

        console.log('📊 College Images Status:\n');
        console.log('ID | College Name                    | Header | Footer | Header Size | Footer Size');
        console.log('---|--------------------------------|--------|--------|-------------|------------');

        colleges.forEach(college => {
            const headerSize = college.header_size > 0 ? `${(college.header_size / 1024).toFixed(2)} KB` : '-';
            const footerSize = college.footer_size > 0 ? `${(college.footer_size / 1024).toFixed(2)} KB` : '-';

            console.log(
                `${college.id.toString().padEnd(3)}| ${college.name.padEnd(30)} | ${college.has_header.padEnd(6)} | ${college.has_footer.padEnd(6)} | ${headerSize.padEnd(11)} | ${footerSize}`
            );
        });

        console.log('\n✅ Check complete!');

        // Show image URLs
        console.log('\n📍 Image URLs:');
        colleges.forEach(college => {
            if (college.has_header === 'YES' || college.has_footer === 'YES') {
                console.log(`\n${college.name} (ID: ${college.id}):`);
                if (college.has_header === 'YES') {
                    console.log(`  Header: http://localhost:5000/api/colleges/${college.id}/header-image`);
                }
                if (college.has_footer === 'YES') {
                    console.log(`  Footer: http://localhost:5000/api/colleges/${college.id}/footer-image`);
                }
            }
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkCollegeImages();
