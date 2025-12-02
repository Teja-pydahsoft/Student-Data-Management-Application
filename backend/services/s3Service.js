/**
 * AWS S3 Service
 * Handles S3 bucket operations for student document storage
 * AWS credentials are loaded from environment variables
 */

require('dotenv').config();
const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

/**
 * Initialize AWS S3 client
 * @returns {Object} S3 client instance
 */
function getS3Client() {
  try {
    // Validate required environment variables
    const requiredVars = [
      'AWS_REGION',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'S3_BUCKET_NAME'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    return s3Client;
  } catch (error) {
    console.error('Error initializing S3 client:', error);
    throw new Error(`Failed to initialize S3 client: ${error.message}`);
  }
}

/**
 * Generate S3 key path for student document
 * Structure: College/Batch/Course/Branch/AdmissionNumber/FileName
 * @param {Object} studentInfo - Student information
 * @param {String} fileName - Document file name
 * @returns {String} S3 key path
 */
function generateS3Key(studentInfo, fileName) {
  // Sanitize folder names (remove invalid characters)
  const sanitize = (name) => {
    return (name || 'Unknown')
      .toString()
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .trim()
      .substring(0, 100); // Limit length
  };

  const sanitizedCollege = sanitize(studentInfo.college);
  const sanitizedBatch = sanitize(studentInfo.batch);
  const sanitizedCourse = sanitize(studentInfo.course);
  const sanitizedBranch = sanitize(studentInfo.branch);
  const sanitizedAdmission = sanitize(studentInfo.admissionNumber);
  const sanitizedFileName = sanitize(fileName);

  // Build path: College/Batch/Course/Branch/AdmissionNumber/FileName
  const s3Key = `${sanitizedCollege}/${sanitizedBatch}/${sanitizedCourse}/${sanitizedBranch}/${sanitizedAdmission}/${sanitizedFileName}`;
  
  return s3Key;
}

/**
 * Convert base64 or file path to buffer
 * @param {Buffer|String|String} fileData - File data (Buffer, base64 string, or file path)
 * @returns {Buffer} File buffer
 */
function getFileBuffer(fileData) {
  let buffer;
  
  if (typeof fileData === 'string') {
    if (fileData.startsWith('data:')) {
      // Extract base64 from data URL
      const base64Data = fileData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (fs.existsSync(fileData)) {
      // It's a file path
      buffer = fs.readFileSync(fileData);
    } else {
      // Assume it's a base64 string
      buffer = Buffer.from(fileData, 'base64');
    }
  } else {
    buffer = fileData;
  }
  
  return buffer;
}

/**
 * Upload file to S3 bucket
 * @param {Buffer|String} fileData - File data (Buffer, base64 string, or file path)
 * @param {String} fileName - Name for the file
 * @param {String} mimeType - MIME type of the file
 * @param {Object} studentInfo - Student information
 * @param {String} studentInfo.college - College name
 * @param {String} studentInfo.batch - Batch/Academic year
 * @param {String} studentInfo.course - Course name
 * @param {String} studentInfo.branch - Branch name
 * @param {String} studentInfo.admissionNumber - Admission number or PIN
 * @returns {Object} Uploaded file information
 */
async function uploadFile(fileData, fileName, mimeType, studentInfo) {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    // Convert file data to buffer
    const buffer = getFileBuffer(fileData);

    // Sanitize file name
    const sanitizedFileName = (fileName || 'file')
      .toString()
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .trim()
      .substring(0, 200);

    // Generate S3 key
    const s3Key = generateS3Key(studentInfo, sanitizedFileName);

    // Upload file to S3
    const uploadParams = {
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream',
      // Make files publicly readable (or use presigned URLs for private access)
      // ACL: 'public-read' // Uncomment if you want public access
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    // Generate public URL or presigned URL
    const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    
    // For private buckets, generate presigned URL (valid for 1 year)
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key
      }),
      { expiresIn: 31536000 } // 1 year
    );

    return {
      key: s3Key,
      fileName: sanitizedFileName,
      publicUrl: publicUrl,
      presignedUrl: presignedUrl,
      bucket: bucketName,
      folderPath: `${studentInfo.college}/${studentInfo.batch}/${studentInfo.course}/${studentInfo.branch}/${studentInfo.admissionNumber}`
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

/**
 * Upload student document to organized S3 folder structure
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
    const uploadResult = await uploadFile(fileData, fileName, mimeType, studentInfo);

    return {
      success: true,
      ...uploadResult,
      // For backward compatibility with Google Drive structure
      fileId: uploadResult.key,
      webViewLink: uploadResult.presignedUrl || uploadResult.publicUrl,
      webContentLink: uploadResult.presignedUrl || uploadResult.publicUrl
    };
  } catch (error) {
    console.error('Error uploading student document to S3:', error);
    throw error;
  }
}

/**
 * Generate presigned URL for S3 object
 * @param {String} s3Key - S3 object key
 * @param {Number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {String} Presigned URL
 */
async function getPresignedUrl(s3Key, expiresIn = 3600) {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

/**
 * Check if file exists in S3
 * @param {String} s3Key - S3 object key
 * @returns {Boolean} True if file exists
 */
async function fileExists(s3Key) {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME environment variable is not set');
    }

    await s3Client.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: s3Key
    }));

    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Test S3 connection
 * @returns {Promise<Boolean>} True if connection successful
 */
async function testConnection() {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.S3_BUCKET_NAME;

    if (!bucketName) {
      throw new Error('S3_BUCKET_NAME is not set');
    }

    // Try to list objects in the bucket (with limit 1 to minimize cost)
    await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1
    }));

    return true;
  } catch (error) {
    console.error('S3 connection test failed:', error);
    throw error;
  }
}

module.exports = {
  getS3Client,
  generateS3Key,
  uploadFile,
  uploadStudentDocument,
  getPresignedUrl,
  fileExists,
  testConnection
};

