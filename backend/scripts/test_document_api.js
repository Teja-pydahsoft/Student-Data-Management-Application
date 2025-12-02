/**
 * Test Document Requirements API
 * Quick script to test all document requirements endpoints
 * 
 * Usage: node scripts/test_document_api.js
 * 
 * Note: You need to be logged in and have a valid JWT token
 * Get your token from browser DevTools → Application → Local Storage → token
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/settings/documents`;

// Get JWT token from command line or environment
const JWT_TOKEN = process.argv[2] || process.env.JWT_TOKEN;

if (!JWT_TOKEN) {
  console.error('❌ JWT Token required!');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/test_document_api.js YOUR_JWT_TOKEN');
  console.error('');
  console.error('Or set JWT_TOKEN in .env file');
  console.error('');
  console.error('To get your token:');
  console.error('  1. Login to admin panel');
  console.error('  2. Open browser DevTools (F12)');
  console.error('  3. Go to Application → Local Storage');
  console.error('  4. Copy the "token" value');
  process.exit(1);
}

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Authorization': `Bearer ${JWT_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testAPI() {
  console.log('🧪 Testing Document Requirements API...');
  console.log('');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log('');

  let testData = null;

  try {
    // Test 1: GET All (should be empty initially)
    console.log('1️⃣  Testing GET /api/settings/documents');
    const getAllResponse = await api.get('/');
    console.log('   ✅ Success!');
    console.log(`   📊 Found ${getAllResponse.data.data.length} requirements`);
    console.log('');

    // Test 2: POST Create
    console.log('2️⃣  Testing POST /api/settings/documents');
    const createData = {
      course_type: 'UG',
      academic_stage: '10th',
      required_documents: [
        '10th Certificate',
        '10th Study Certificate',
        '10th TC (Transfer Certificate)'
      ],
      is_enabled: true
    };

    const createResponse = await api.post('/', createData);
    console.log('   ✅ Success!');
    console.log(`   📝 Created: ${createResponse.data.data.course_type} - ${createResponse.data.data.academic_stage}`);
    testData = createResponse.data.data;
    console.log('');

    // Test 3: GET Specific
    console.log('3️⃣  Testing GET /api/settings/documents/UG/10th');
    const getSpecificResponse = await api.get('/UG/10th');
    console.log('   ✅ Success!');
    console.log(`   📋 Documents: ${getSpecificResponse.data.data.required_documents.join(', ')}`);
    console.log('');

    // Test 4: GET All Again (should have 1 now)
    console.log('4️⃣  Testing GET /api/settings/documents (again)');
    const getAllAgainResponse = await api.get('/');
    console.log('   ✅ Success!');
    console.log(`   📊 Now found ${getAllAgainResponse.data.data.length} requirements`);
    console.log('');

    // Test 5: DELETE
    console.log('5️⃣  Testing DELETE /api/settings/documents/UG/10th');
    const deleteResponse = await api.delete('/UG/10th');
    console.log('   ✅ Success!');
    console.log('   🗑️  Deleted test requirement');
    console.log('');

    // Test 6: Verify Deleted
    console.log('6️⃣  Testing GET /api/settings/documents (verify deleted)');
    const verifyResponse = await api.get('/');
    console.log('   ✅ Success!');
    console.log(`   📊 Found ${verifyResponse.data.data.length} requirements (should be 0)`);
    console.log('');

    console.log('✅ All API tests passed!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Test the frontend UI in Settings → Document Requirements');
    console.log('   2. Test document upload in Public Form');
    console.log('   3. Test S3 integration by approving a submission');

  } catch (error) {
    console.error('');
    console.error('❌ Test failed!');
    console.error('');
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.message}`);
      console.error(`   Data:`, error.response.data);
      
      if (error.response.status === 401) {
        console.error('');
        console.error('💡 Your JWT token is invalid or expired.');
        console.error('   Please login again and get a new token.');
      }
    } else if (error.request) {
      console.error('   No response received from server');
      console.error('   Check if backend is running on:', BASE_URL);
    } else {
      console.error(`   Error: ${error.message}`);
    }
    
    process.exit(1);
  }
}

// Run tests
testAPI()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

