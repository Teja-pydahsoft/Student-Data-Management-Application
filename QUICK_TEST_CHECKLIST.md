# Quick Testing Checklist

## ✅ Step-by-Step Testing Guide

### 🔧 Step 1: Verify Database Setup (Already Done!)
```bash
npm run test-supabase
```
**Expected:** ✅ Everything is set up correctly!

---

### 🌐 Step 2: Start Your Backend Server
```bash
cd backend
npm run dev
```
**Expected:** Server running on port 5000

---

### 🔐 Step 3: Login to Admin Panel
1. Open your frontend: `http://localhost:3000` (or your frontend URL)
2. **Login** with admin credentials
3. **Verify** you can access the dashboard

---

### ⚙️ Step 4: Test Document Requirements Settings

#### 4.1 Navigate to Settings
1. Click **"Settings"** in the sidebar
2. Look for **"Document Requirements"** button (should be a new button with a file icon)
3. Click it

#### 4.2 Create Your First Requirement
1. Click **"Add Requirements"** button
2. Fill in:
   - **Course Type:** Select "UG"
   - **Academic Stage:** Select "10th"
   - **Required Documents:** 
     - Click dropdown, select "10th Certificate"
     - Click "+" button
     - Repeat for "10th Study Certificate" and "10th TC (Transfer Certificate)"
   - **Enabled:** ✓ (checked)
3. Click **"Save"**

**Expected:** 
- ✅ Success toast message
- ✅ Requirement appears in the list below
- ✅ Shows "UG" and "10th" badges

#### 4.3 Create More Requirements
Create these combinations:
- ✅ UG + Inter (with Inter documents)
- ✅ UG + Diploma (with Diploma documents)
- ✅ PG + 10th (with 10th documents)
- ✅ PG + UG (with UG documents)

#### 4.4 Test Delete
1. Click the **trash icon** on any requirement
2. Confirm deletion
3. Verify it's removed

---

### 📝 Step 5: Test Public Registration Form

#### 5.1 Get Form URL
1. In Settings, go to **"Registration Form"** section
2. Note the form ID or get the public URL
3. Open the form in a new browser/incognito window

#### 5.2 Fill Basic Information
1. Fill in student name, college, batch, etc.
2. **Select a Course** (e.g., "B.Tech" for UG or "M.Tech" for PG)

#### 5.3 Test Document Upload Section
1. **Scroll down** - you should see a "Document Uploads" section
2. **Toggle** "Enable Document Upload" switch
3. **Verify** document upload fields appear based on:
   - Course type (UG shows 10th/Inter/Diploma docs)
   - PG shows all UG docs + UG certificates

#### 5.4 Upload Documents
1. Click on each document upload field
2. **Select a file** (PDF, JPG, or PNG)
3. **Verify** file name appears after selection
4. Try uploading a file > 10MB - should show error

#### 5.5 Test Validation
1. Try submitting **without** uploading required documents
2. **Expected:** Error message showing which documents are required
3. Upload all required documents
4. **Submit** the form
5. **Expected:** Success message "Submission Successful!"

---

### ✅ Step 6: Test Document Storage (Admin Approval)

#### 6.1 Approve a Submission
1. Go to **"Submissions"** page in admin panel
2. Find the submission you just created
3. Click **"Approve"**
4. Enter an admission number
5. Click **"Approve"**

#### 6.2 Verify Google Drive
1. Go to Google Drive: https://drive.google.com/drive/folders/1bfjkg0mtNFGDjiswdv9ljtlw-7QgU35O
2. **Navigate** to: `College/Batch/Course/Branch/AdmissionNumber/`
3. **Verify** documents are uploaded with correct names

#### 6.3 Verify Student Record
1. Go to **"Students"** page
2. Search for the student by admission number
3. **Check** student details
4. **Verify** `student_data` contains `google_drive_documents` with links

---

### 🆔 Step 7: Test APAAR ID Field (Optional)

#### 7.1 Add APAAR ID to Form
1. Go to **Settings → Registration Form → Edit Form**
2. Click **"Add New Field"** → Select **"Text"**
3. Set:
   - **Label:** "APAAR ID"
   - **Key:** "apaar_id"
   - **Required:** (your choice)
4. Click **"Save Changes"**

#### 7.2 Test in Public Form
1. Open the public registration form
2. **Verify** "APAAR ID" field appears
3. Enter an APAAR ID
4. Submit and verify it's saved

---

## 🐛 Common Issues & Solutions

### Issue: "Document Requirements" button not showing
**Solution:** 
- Clear browser cache
- Refresh the page
- Check browser console for errors

### Issue: Document upload section not appearing
**Solution:**
- Make sure you've selected a course first
- Check that document requirements are configured for that course type
- Check browser console for JavaScript errors

### Issue: Documents not uploading to Google Drive
**Solution:**
- Check backend logs for errors
- Verify `.env` has all Google Drive credentials
- Verify service account has access to the Drive folder
- Check: `npm list googleapis` (should be installed)

### Issue: API returns 401 Unauthorized
**Solution:**
- Make sure you're logged in
- Check JWT token is valid
- Try logging out and logging back in

---

## ✅ Success Indicators

You'll know everything works when:

- ✅ Can create/view/delete document requirements in Settings
- ✅ Public form shows document upload section when course is selected
- ✅ Can upload documents in public form
- ✅ Form validation works (shows errors for missing documents)
- ✅ Documents appear in Google Drive after approval
- ✅ Google Drive folder structure is: `College/Batch/Course/Branch/AdmissionNumber/`
- ✅ Student record contains Google Drive document links

---

## 📞 Need Help?

If something doesn't work:
1. Check browser console (F12 → Console tab)
2. Check backend logs (terminal where server is running)
3. Verify database table exists: `npm run test-supabase`
4. Check `.env` file has all required variables

---

**Ready?** Start with Step 2 and work through each step! 🚀

