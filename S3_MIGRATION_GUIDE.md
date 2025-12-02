# S3 Migration Guide - Student Documents Storage

## Overview
The codebase has been migrated from Google Drive to AWS S3 for storing student documents. All document uploads now go directly to an S3 bucket with organized folder structure.

## Changes Made

### 1. Backend Changes

#### New Service: `backend/services/s3Service.js`
- Created new S3 service to replace Google Drive service
- Handles file uploads to S3 with organized folder structure
- Generates presigned URLs for document access
- Maintains same folder structure: `College/Batch/Course/Branch/AdmissionNumber/FileName`

#### Updated Controllers
- **`backend/controllers/studentController.js`**: Updated to use S3 service instead of Google Drive
- **`backend/controllers/submissionController.js`**: Updated to use S3 service for document uploads during submission approval

#### Updated Dependencies
- **`backend/package.json`**: Added AWS SDK packages:
  - `@aws-sdk/client-s3`: ^3.490.0
  - `@aws-sdk/s3-request-presigner`: ^3.490.0

### 2. Frontend Changes

#### Updated Component: `frontend/src/pages/Submissions.jsx`
- Renamed `googleDriveDocuments` state to `s3Documents`
- Updated document display logic to use S3 URLs
- Changed UI text from "Google Drive" to "S3" or "Open Document"
- Updated document preview to work with S3 presigned URLs

### 3. Environment Configuration

#### Updated: `ENV_CONFIGURATION.txt`
- Removed Google Drive configuration
- Added S3 configuration variables:
  - `AWS_REGION`
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `S3_BUCKET_NAME`

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

This will install the new AWS SDK packages.

### 2. Configure AWS S3

#### Create S3 Bucket
1. Log in to AWS Console
2. Navigate to S3 service
3. Create a new bucket (or use existing one)
4. Choose the same region as your application (e.g., `ap-south-1`)
5. Configure bucket settings:
   - **Block Public Access**: Choose based on your security requirements
   - **Versioning**: Optional
   - **Encryption**: Recommended (SSE-S3 or SSE-KMS)

#### Create IAM User/Policy
1. Go to IAM Console
2. Create a new IAM user or use existing one
3. Attach a policy with the following permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name/*",
        "arn:aws:s3:::your-bucket-name"
      ]
    }
  ]
}
```
4. Create access keys for the IAM user
5. Save the Access Key ID and Secret Access Key securely

### 3. Update Environment Variables

Add the following to your `backend/.env` file:

```env
# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=your_s3_bucket_name
```

**Important**: Replace the placeholder values with your actual AWS credentials and bucket name.

### 4. Test S3 Connection (Optional)

You can test the S3 connection by creating a test script:

```javascript
// backend/scripts/test_s3_connection.js
const s3Service = require('../services/s3Service');

async function test() {
  try {
    const result = await s3Service.testConnection();
    console.log('✅ S3 connection successful!');
  } catch (error) {
    console.error('❌ S3 connection failed:', error.message);
  }
}

test();
```

Run it with:
```bash
node backend/scripts/test_s3_connection.js
```

## S3 Folder Structure

Documents are stored in S3 with the following structure:
```
s3://your-bucket-name/
  └── College_Name/
      └── Batch/
          └── Course/
              └── Branch/
                  └── AdmissionNumber/
                      └── Document_Name.pdf
```

Example:
```
s3://student-documents/
  └── Pydah_College/
      └── 2024-25/
          └── B.Tech/
              └── CSE/
                  └── ADM001/
                      └── 10th_Certificate.pdf
                      └── Inter_Certificate.pdf
```

## Document Access

### Presigned URLs
- Documents are accessed via presigned URLs (valid for 1 year)
- URLs are automatically generated when documents are uploaded
- Presigned URLs provide secure, time-limited access to private S3 objects

### Public URLs (if bucket is public)
- If your S3 bucket is configured for public access, documents can be accessed via public URLs
- Format: `https://bucket-name.s3.region.amazonaws.com/path/to/file`

## Migration Notes

### Backward Compatibility
- The code maintains backward compatibility with existing document structure
- Documents stored in `uploaded_documents` field in `student_data` JSON
- Frontend automatically handles both S3 URLs and base64 data

### Data Migration
- **Existing Google Drive documents**: If you have existing documents in Google Drive, you'll need to:
  1. Download them from Google Drive
  2. Re-upload them through the system to store in S3
  OR
  3. Manually migrate them to S3 and update the database records

### Legacy Code Cleanup
- All Google Drive service files have been removed from the codebase
- The `googleapis` package has been removed from `package.json`
- The codebase now exclusively uses S3 for document storage

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all S3 environment variables are set in `.env`
   - Check for typos in variable names

2. **"Access Denied" errors**
   - Verify IAM user has correct permissions
   - Check bucket policy allows the IAM user
   - Ensure bucket name is correct

3. **"Bucket not found"**
   - Verify bucket exists in the specified region
   - Check bucket name spelling
   - Ensure AWS credentials have access to the bucket

4. **Documents not displaying**
   - Check browser console for errors
   - Verify presigned URLs are being generated correctly
   - Check CORS settings on S3 bucket if accessing from frontend

### CORS Configuration (if needed)

If accessing S3 directly from frontend, configure CORS on your S3 bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://your-frontend-domain.com"],
    "ExposeHeaders": []
  }
]
```

## Next Steps

1. ✅ Install dependencies: `npm install` in backend directory
2. ✅ Configure AWS S3 bucket and IAM user
3. ✅ Update `.env` file with S3 credentials
4. ✅ Test document upload functionality
5. ✅ Verify documents are accessible via presigned URLs
6. (Optional) Remove Google Drive service files if no longer needed

## Support

If you encounter any issues:
1. Check AWS CloudWatch logs for S3 errors
2. Verify IAM permissions
3. Test S3 connection using the test script
4. Review server logs for detailed error messages

