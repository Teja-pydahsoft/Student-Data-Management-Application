# Testing Guide - Document Requirements Feature

## ✅ What's Already Done

- ✅ Database table created (`document_requirements`)
- ✅ Backend API endpoints ready
- ✅ Frontend UI components created
- ✅ Migration completed successfully

## 🧪 Testing Checklist

### Step 1: Test Backend API Endpoints

#### 1.1 Test GET All Document Requirements
```bash
# Should return empty array initially
curl http://localhost:5000/api/settings/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** `{"success": true, "data": []}`

#### 1.2 Test POST Create Document Requirements
```bash
curl -X POST http://localhost:5000/api/settings/documents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "course_type": "UG",
    "academic_stage": "10th",
    "required_documents": [
      "10th Certificate",
      "10th Study Certificate",
      "10th TC (Transfer Certificate)"
    ],
    "is_enabled": true
  }'
```

**Expected:** `{"success": true, "message": "Document requirements saved successfully", "data": {...}}`

#### 1.3 Test GET Specific Document Requirements
```bash
curl http://localhost:5000/api/settings/documents/UG/10th \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** Returns the document requirements for UG/10th

#### 1.4 Test DELETE Document Requirements
```bash
curl -X DELETE http://localhost:5000/api/settings/documents/UG/10th \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** `{"success": true, "message": "Document requirements deleted successfully"}`

### Step 2: Test Frontend UI

#### 2.1 Access Settings Page
1. **Login** to your admin panel
2. **Navigate** to Settings page
3. **Click** on "Document Requirements" section (should be a new button in the sidebar)

#### 2.2 Create Document Requirements
1. Click **"Add Requirements"** button
2. Fill in the form:
   - Course Type: Select "UG" or "PG"
   - Academic Stage: Select "10th", "Inter", "Diploma", or "UG"
   - Required Documents: Add documents from the dropdown
   - Enabled: Check the checkbox
3. Click **"Save"**
4. Verify the requirement appears in the list

#### 2.3 Test Different Combinations
Create requirements for:
- ✅ UG + 10th
- ✅ UG + Inter
- ✅ UG + Diploma
- ✅ PG + 10th
- ✅ PG + Inter
- ✅ PG + Diploma
- ✅ PG + UG

#### 2.4 Test Delete
1. Click the **trash icon** on any requirement
2. Confirm deletion
3. Verify it's removed from the list

### Step 3: Test Public Form (Student Registration)

#### 3.1 Access Public Registration Form
1. **Get the form URL** from Settings → Registration Form
2. **Open** the form in a browser (or use the public link)

#### 3.2 Test Document Upload Feature
1. Fill in basic student information
2. **Select a Course** (e.g., "B.Tech" for UG or "M.Tech" for PG)
3. **Enable Document Upload** toggle should appear
4. Click the toggle to enable document uploads
5. **Verify** that document upload fields appear based on:
   - Course type (UG vs PG)
   - Document requirements configured in Settings

#### 3.3 Test Document Upload
1. **Upload documents** for each required field
2. **Verify** file validation (should accept PDF, JPG, PNG up to 10MB)
3. **Submit** the form
4. **Verify** submission is successful

#### 3.4 Test Validation
1. Try submitting **without** uploading required documents
2. Should show validation error: "X is required"
3. Upload documents and verify submission works

### Step 4: Test Document Storage in Google Drive

#### 4.1 Approve a Submission
1. Go to **Submissions** page in admin panel
2. Find a submission with uploaded documents
3. **Approve** the submission
4. **Check** that documents are uploaded to Google Drive

#### 4.2 Verify Google Drive Structure
1. Go to your Google Drive folder: `1bfjkg0mtNFGDjiswdv9ljtlw-7QgU35O`
2. **Verify** folder structure:
   ```
   College/
     └── Batch/
         └── Course/
             └── Branch/
                 └── AdmissionNumber/
                     ├── 10th_Certificate.pdf
                     ├── 10th_Study_Certificate.pdf
                     └── ...
   ```

#### 4.3 Verify Student Record
1. Check the **student record** in the database
2. **Verify** `student_data` JSON contains `google_drive_documents` with links:
   ```json
   {
     "google_drive_documents": {
       "10th Certificate": "https://drive.google.com/...",
       "10th Study Certificate": "https://drive.google.com/..."
     }
   }
   ```

### Step 5: Test APAAR ID Field

#### 5.1 Add APAAR ID to Form
1. Go to **Settings → Registration Form → Edit Form**
2. Click **"Add New Field"** → Select **"Text"**
3. Set label: **"APAAR ID"**
4. Set key: **"apaar_id"** (or let it auto-generate)
5. Mark as required (optional)
6. **Save** the form

#### 5.2 Test in Public Form
1. **Open** the public registration form
2. **Verify** "APAAR ID" field appears
3. **Enter** an APAAR ID
4. **Submit** and verify it's saved

## 🐛 Troubleshooting

### API Returns 401 Unauthorized
- **Solution:** Make sure you're logged in and have a valid JWT token
- Check `Authorization` header in API requests

### Document Requirements Not Showing in Frontend
- **Check:** Browser console for errors
- **Verify:** API endpoint returns data: `GET /api/settings/documents`
- **Check:** Network tab in browser DevTools

### Documents Not Uploading to Google Drive
- **Check:** `.env` file has all Google Drive credentials
- **Verify:** Service account has access to the Drive folder
- **Check:** Backend logs for errors during approval
- **Verify:** `googleapis` package is installed: `npm list googleapis`

### Form Not Showing Document Upload Section
- **Check:** Course is selected in the form
- **Verify:** Document requirements are configured for that course type
- **Check:** Browser console for JavaScript errors

## ✅ Success Criteria

- [ ] Can create document requirements via Settings UI
- [ ] Can view all document requirements
- [ ] Can delete document requirements
- [ ] Public form shows document upload section when course is selected
- [ ] Documents can be uploaded in public form
- [ ] Form validation works for required documents
- [ ] Documents are stored in Google Drive on approval
- [ ] Google Drive folder structure is correct
- [ ] Student record contains Google Drive document links
- [ ] APAAR ID field can be added and works in forms

## 📝 Quick Test Commands

### Using the Test Script
```bash
# Test database connection and table
npm run test-supabase

# Should show:
# ✅ document_requirements table EXISTS!
# ✅ Everything is set up correctly!
```

### Using Postman/Thunder Client
Import these endpoints:
- `GET /api/settings/documents`
- `POST /api/settings/documents`
- `GET /api/settings/documents/:courseType/:academicStage`
- `DELETE /api/settings/documents/:courseType/:academicStage`

Make sure to include `Authorization: Bearer YOUR_TOKEN` header.

---

**Ready to test?** Start with Step 1 (Backend API) and work through each step systematically!

