// Quick test to verify routes are working
const axios = require('axios');

async function quickTest() {
    try {
        const response = await axios.get('http://localhost:5000/api/colleges/1/header-image', {
            responseType: 'arraybuffer',
            validateStatus: () => true
        });

        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers['content-type']);

        if (response.status === 200) {
            console.log('✅ Images are accessible!');
            console.log('\nTest in browser:');
            console.log('http://localhost:5000/api/colleges/1/header-image');
            console.log('http://localhost:5000/api/colleges/1/footer-image');
        } else {
            console.log('❌ Error:', response.status);
            console.log(response.data.toString());
        }
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        console.log('\nMake sure the backend server is running on port 5000');
    }
}

quickTest();
