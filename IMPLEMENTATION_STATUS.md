# Implementation Status - Document Upload & Google Drive Integration

## ✅ Completed Backend Tasks

### 1. Environment Configuration
- ✅ Created `GOOGLE_DRIVE_ENV_SETUP.md` with comprehensive documentation
- ✅ Defined all required environment variables for Google Service Account
- ✅ Added instructions for private key formatting and escaping

### 2. Google Drive Service
- ✅ Created `backend/services/googleDriveService.js`
- ✅ Implemented service account reconstruction from environment variables
- ✅ Created folder structure: `College/Batch/Course/Branch/AdmissionNumber/`
- ✅ Implemented document upload functionality
- ✅ Added `googleapis` package to `package.json`

### 3. Document Settings Controller
- ✅ Created `backend/controllers/documentSettingsController.js`
- ✅ Implemented CRUD operations for document requirements
- ✅ Defined default document types (UG, PG, Common)
- ✅ Added routes in `backend/routes/settingsRoutes.js`

### 4. Submission Approval Integration
- ✅ Updated `approveSubmission` in `submissionController.js`
- ✅ Integrated Google Drive upload during approval
- ✅ Stores document links in student record
- ✅ Handles errors gracefully (non-fatal)

## 🔄 Remaining Frontend Tasks

### 1. Settings Page (`frontend/src/pages/Settings.jsx`)
**Required Changes:**
- Add "Document Requirements" section in form builder
- Add toggle for enabling/disabling document uploads
- Add UI for configuring which documents are required/optional
- Add APAAR ID field option to form builder

**Implementation Notes:**
- Add new section after "Registration Forms" section
- Create document requirements configuration UI
- Allow admins to enable/disable each document type
- Mark documents as required or optional

### 2. Public Form (`frontend/src/pages/PublicForm.jsx`)
**Required Changes:**
- Add conditional document upload section (only show if enabled in settings)
- Detect course type (UG vs PG) from course selection
- Show appropriate documents based on course type:
  - **UG**: 10th, Inter/Diploma selection (with years), Study Cert, TC
  - **PG**: All UG documents + UG Certificate, UG Study Cert, UG TC
- Add Inter (2 years) vs Diploma (3 years) selection
- Add APAAR ID field
- Handle file uploads and convert to base64 for submission

**Implementation Notes:**
- Check document requirements from settings API
- Show document upload section only if `document_upload_enabled` is true
- Use course name to determine if it's UG or PG (e.g., "B.Tech" = UG, "M.Tech" = PG)
- Show Inter/Diploma selection for UG courses
- Display appropriate document fields based on selection

### 3. Add Student Form (`frontend/src/pages/AddStudent.jsx`)
**Required Changes:**
- Sync with PublicForm structure
- Add same document upload fields
- Add APAAR ID field
- Ensure consistency between self-registration and manual entry

**Implementation Notes:**
- Reuse document upload components from PublicForm
- Maintain same validation logic
- Store documents in same format

## 📋 Document Requirements Structure

### UG Courses
```
Required:
- 10th Certificate
- 10th Study Certificate  
- 10th TC (Transfer Certificate)

Conditional (choose one):
- Inter Certificate (2 years) + Inter Study Cert + Inter TC
  OR
- Diploma Certificate (3 years) + Diploma Study Cert + Diploma TC

Optional:
- APAAR ID
```

### PG Courses
```
All UG Documents (as above)
+
Required:
- UG Certificate
- UG Study Certificate
- UG TC (Transfer Certificate)

Optional:
- APAAR ID
```

## 🔧 Environment Variables Required

Add these to `backend/.env`:

```env
# Google Service Account
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/...

# Google Drive
DRIVE_MAIN_FOLDER_ID=1bfjkg0mtNFGDjiswdv9ljtlw-7QgU35O

# App Environment
NODE_ENV=production

# MySQL (existing)
DB_HOST=your-host
DB_USER=your-user
DB_PASSWORD=your-password
DB_NAME=your-database
```

## 📝 Next Steps

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install googleapis
   ```

2. **Configure Environment:**
   - Copy Google Service Account JSON values to `.env`
   - Follow formatting instructions in `GOOGLE_DRIVE_ENV_SETUP.md`

3. **Test Backend:**
   - Test Google Drive connection
   - Test document upload during approval

4. **Implement Frontend:**
   - Add document requirements UI in Settings
   - Add document upload section to PublicForm
   - Sync AddStudent form with PublicForm
   - Add APAAR ID field

5. **Test End-to-End:**
   - Submit form with documents
   - Approve submission
   - Verify documents uploaded to Google Drive
   - Verify folder structure is correct

## 🎯 API Endpoints Available

### Document Settings
- `GET /api/settings/document-requirements` - Get all document requirements
- `PUT /api/settings/document-requirements` - Update document requirements
- `GET /api/settings/document-requirements/:courseType` - Get requirements for UG/PG

### Form Submission
- `POST /api/submissions/:formId` - Submit form (handles document uploads)
- `POST /api/submissions/:submissionId/approve` - Approve submission (uploads to Drive)

## 📁 Google Drive Folder Structure

```
DRIVE_MAIN_FOLDER_ID/
  └── College Name/
      └── Batch (e.g., "2024-2028")/
          └── Course Name (e.g., "B.Tech")/
              └── Branch Name (e.g., "CSE")/
                  └── Admission Number (e.g., "20250001")/
                      ├── 10th_Certificate.pdf
                      ├── 10th_Study_Certificate.pdf
                      ├── 10th_TC.pdf
                      ├── Inter_Certificate.pdf (if Inter selected)
                      ├── Inter_Study_Certificate.pdf
                      ├── Inter_TC.pdf
                      ├── Diploma_Certificate.pdf (if Diploma selected)
                      ├── Diploma_Study_Certificate.pdf
                      ├── Diploma_TC.pdf
                      ├── UG_Certificate.pdf (if PG course)
                      ├── UG_Study_Certificate.pdf
                      ├── UG_TC.pdf
                      └── APAAR_ID.pdf (if provided)
```

## ⚠️ Important Notes

1. **Private Key Formatting**: The private key in `.env` must use `\n` for newlines, not actual newlines
2. **Drive Permissions**: Ensure the service account email has access to the main folder
3. **File Size Limits**: Consider implementing file size limits (currently handled by multer)
4. **Error Handling**: Drive upload errors are non-fatal - approval will succeed even if upload fails
5. **Document Links**: Uploaded document links are stored in `student_data.uploaded_documents` JSON field

