const axios = require('axios');

async function testImageEndpoint() {
    try {
        console.log('Testing college image endpoints...\n');

        // Test header image
        console.log('Testing: http://localhost:5000/api/colleges/1/header-image');
        const headerResponse = await axios.get('http://localhost:5000/api/colleges/1/header-image', {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        console.log('Header Image Response:');
        console.log('  Status:', headerResponse.status);
        console.log('  Content-Type:', headerResponse.headers['content-type']);
        console.log('  Size:', headerResponse.data.length, 'bytes');

        // Test footer image
        console.log('\nTesting: http://localhost:5000/api/colleges/1/footer-image');
        const footerResponse = await axios.get('http://localhost:5000/api/colleges/1/footer-image', {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        console.log('Footer Image Response:');
        console.log('  Status:', footerResponse.status);
        console.log('  Content-Type:', footerResponse.headers['content-type']);
        console.log('  Size:', footerResponse.data.length, 'bytes');

        if (headerResponse.status === 200 && footerResponse.status === 200) {
            console.log('\n✅ Both endpoints working correctly!');
        } else {
            console.log('\n❌ Some endpoints failed');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testImageEndpoint();
