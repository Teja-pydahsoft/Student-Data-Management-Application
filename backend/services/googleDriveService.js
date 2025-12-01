/**
 * Google Drive Service
 * Handles Google Drive API operations using Service Account authentication
 * Service Account credentials are loaded from environment variables
 */

require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Reconstruct Google Service Account credentials from environment variables
 * @returns {Object} Service account credentials object
 */
function getServiceAccountCredentials() {
  // Validate required environment variables
  const requiredVars = [
    'GOOGLE_PROJECT_ID',
    'GOOGLE_PRIVATE_KEY_ID',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_AUTH_URI',
    'GOOGLE_TOKEN_URI',
    'GOOGLE_AUTH_PROVIDER_X509_CERT_URL',
    'GOOGLE_CLIENT_CERT_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Process private key - handle both \n escaped and actual newlines
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  
  // Replace \n with actual newlines if needed
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  
  // Ensure proper formatting
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format: missing BEGIN marker');
  }
  if (!privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Invalid private key format: missing END marker');
  }

  // Reconstruct service account object
  const credentials = {
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL
  };

  return credentials;
}

/**
 * Initialize Google Drive API client
 * @returns {Object} Google Drive API client
 */
function getDriveClient() {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    return google.drive({ version: 'v3', auth });
  } catch (error) {
    console.error('Error initializing Google Drive client:', error);
    throw new Error(`Failed to initialize Google Drive: ${error.message}`);
  }
}

/**
 * Get or create folder structure: College/Batch/Course/Branch/AdmissionNumber
 * @param {Object} drive - Google Drive client
 * @param {String} collegeName - College name
 * @param {String} batch - Batch/Academic year
 * @param {String} courseName - Course name
 * @param {String} branchName - Branch name
 * @param {String} admissionNumber - Student admission number or PIN
 * @returns {String} Folder ID
 */
async function getOrCreateStudentFolder(drive, collegeName, batch, courseName, branchName, admissionNumber) {
  const mainFolderId = process.env.DRIVE_MAIN_FOLDER_ID;
  
  if (!mainFolderId) {
    throw new Error('DRIVE_MAIN_FOLDER_ID environment variable is not set');
  }

  // Sanitize folder names (remove invalid characters)
  const sanitize = (name) => {
    return (name || 'Unknown')
      .toString()
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .substring(0, 100); // Limit length
  };

  const sanitizedCollege = sanitize(collegeName);
  const sanitizedBatch = sanitize(batch);
  const sanitizedCourse = sanitize(courseName);
  const sanitizedBranch = sanitize(branchName);
  const sanitizedAdmission = sanitize(admissionNumber);

  // Helper function to find or create folder
  const findOrCreateFolder = async (parentId, folderName) => {
    try {
      // Search for existing folder
      const response = await drive.files.list({
        q: `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create folder if not found
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      };

      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id, name'
      });

      return folder.data.id;
    } catch (error) {
      console.error(`Error creating/finding folder ${folderName}:`, error);
      throw error;
    }
  };

  try {
    // Create folder hierarchy: College > Batch > Course > Branch > AdmissionNumber
    const collegeFolderId = await findOrCreateFolder(mainFolderId, sanitizedCollege);
    const batchFolderId = await findOrCreateFolder(collegeFolderId, sanitizedBatch);
    const courseFolderId = await findOrCreateFolder(batchFolderId, sanitizedCourse);
    const branchFolderId = await findOrCreateFolder(courseFolderId, sanitizedBranch);
    const studentFolderId = await findOrCreateFolder(branchFolderId, sanitizedAdmission);

    return studentFolderId;
  } catch (error) {
    console.error('Error creating folder structure:', error);
    throw new Error(`Failed to create folder structure: ${error.message}`);
  }
}

/**
 * Upload file to Google Drive
 * @param {Buffer|String} fileData - File data (Buffer or base64 string)
 * @param {String} fileName - Name for the file
 * @param {String} mimeType - MIME type of the file
 * @param {String} folderId - Parent folder ID
 * @param {Object} metadata - Additional file metadata (college, batch, course, branch, admissionNumber)
 * @returns {Object} Uploaded file information
 */
async function uploadFile(fileData, fileName, mimeType, folderId, metadata = {}) {
  try {
    const drive = getDriveClient();

    // Convert base64 to buffer if needed
    let buffer;
    if (typeof fileData === 'string') {
      if (fileData.startsWith('data:')) {
        // Extract base64 from data URL
        const base64Data = fileData.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(fileData, 'base64');
      }
    } else {
      buffer = fileData;
    }

    // Sanitize file name
    const sanitizedFileName = (fileName || 'file')
      .toString()
      .replace(/[<>:"/\\|?*]/g, '_')
      .trim()
      .substring(0, 200);

    // Create file metadata
    const fileMetadata = {
      name: sanitizedFileName,
      parents: [folderId]
    };

    // Upload file
    const media = {
      mimeType: mimeType || 'application/octet-stream',
      body: buffer
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    return {
      fileId: file.data.id,
      fileName: file.data.name,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
      folderId: folderId
    };
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Upload student document to organized folder structure
 * @param {Buffer|String} fileData - File data
 * @param {String} fileName - Document name (e.g., "10th_Certificate.pdf")
 * @param {String} mimeType - MIME type
 * @param {Object} studentInfo - Student information
 * @param {String} studentInfo.college - College name
 * @param {String} studentInfo.batch - Batch/Academic year
 * @param {String} studentInfo.course - Course name
 * @param {String} studentInfo.branch - Branch name
 * @param {String} studentInfo.admissionNumber - Admission number or PIN
 * @returns {Object} Upload result with file and folder information
 */
async function uploadStudentDocument(fileData, fileName, mimeType, studentInfo) {
  try {
    const drive = getDriveClient();

    // Get or create student folder
    const studentFolderId = await getOrCreateStudentFolder(
      drive,
      studentInfo.college,
      studentInfo.batch,
      studentInfo.course,
      studentInfo.branch,
      studentInfo.admissionNumber
    );

    // Upload file to student folder
    const uploadResult = await uploadFile(fileData, fileName, mimeType, studentFolderId, studentInfo);

    return {
      success: true,
      ...uploadResult,
      folderPath: `${studentInfo.college}/${studentInfo.batch}/${studentInfo.course}/${studentInfo.branch}/${studentInfo.admissionNumber}`
    };
  } catch (error) {
    console.error('Error uploading student document:', error);
    throw error;
  }
}

/**
 * Test Google Drive connection
 * @returns {Promise<Boolean>} True if connection successful
 */
async function testConnection() {
  try {
    const drive = getDriveClient();
    const mainFolderId = process.env.DRIVE_MAIN_FOLDER_ID;

    if (!mainFolderId) {
      throw new Error('DRIVE_MAIN_FOLDER_ID is not set');
    }

    // Try to access the main folder
    await drive.files.get({
      fileId: mainFolderId,
      fields: 'id, name'
    });

    return true;
  } catch (error) {
    console.error('Google Drive connection test failed:', error);
    throw error;
  }
}

module.exports = {
  getServiceAccountCredentials,
  getDriveClient,
  getOrCreateStudentFolder,
  uploadFile,
  uploadStudentDocument,
  testConnection
};

