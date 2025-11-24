# Phase 2: College Migration Plan - Backend Design & Architecture

**Status**: Design & Planning Phase (NOT IMPLEMENTED)  
**Date**: 2025-01-XX  
**Purpose**: Comprehensive backend migration plan for introducing Colleges hierarchy

---

## 📋 Table of Contents

1. [Database Schema Design](#1-database-schema-design)
2. [ER Diagram](#2-er-diagram)
3. [Migration Strategy](#3-migration-strategy)
4. [Backend API Design](#4-backend-api-design)
5. [Service Layer Structure](#5-service-layer-structure)
6. [Frontend Integration Plan](#6-frontend-integration-plan)
7. [Rollback Plan](#7-rollback-plan)

---

## 1. Database Schema Design

### 1.1 New Table: `colleges`

```sql
CREATE TABLE IF NOT EXISTS colleges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_college_name (name),
  UNIQUE KEY unique_college_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Fields:**
- `id`: Primary key, auto-increment
- `name`: College name (unique, required)
- `code`: Optional college code (unique if provided)
- `is_active`: Boolean flag for soft delete/activation
- `metadata`: JSON field for future extensibility
- `created_at`: Timestamp
- `updated_at`: Auto-updated timestamp

### 1.2 Updated Table: `courses`

**New Column:**
```sql
ALTER TABLE courses 
  ADD COLUMN college_id INT NULL AFTER id,
  ADD INDEX idx_college_id (college_id),
  ADD CONSTRAINT fk_course_college 
    FOREIGN KEY (college_id) REFERENCES colleges(id) 
    ON DELETE SET NULL;
```

**Migration Path:**
1. Add `college_id` as NULL initially
2. Populate with default mappings
3. Set NOT NULL constraint after verification

**Final Schema:**
```sql
-- After migration completion
ALTER TABLE courses 
  MODIFY COLUMN college_id INT NOT NULL;
```

### 1.3 Unchanged Table: `course_branches`

**No changes required** - continues to reference `course_id` as before.

### 1.4 Unchanged Table: `students`

**No changes required** - students continue to reference branches via:
- `course` VARCHAR(100) - text field (legacy)
- `branch` VARCHAR(100) - text field (legacy)

**Note**: Student data integrity is maintained as branches remain linked to courses, which are now linked to colleges.

---

## 2. ER Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE RELATIONSHIPS                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   colleges   │
├──────────────┤
│ id (PK)      │◄──────┐
│ name (UQ)    │       │
│ code (UQ)    │       │
│ is_active    │       │
│ metadata     │       │
│ created_at   │       │
│ updated_at   │       │
└──────────────┘       │
                        │
                        │ college_id (FK)
                        │
┌──────────────┐        │
│   courses    │        │
├──────────────┤        │
│ id (PK)      │        │
│ college_id   │────────┘
│ name (UQ)    │
│ code (UQ)    │
│ total_years  │
│ semesters... │
│ is_active    │
│ metadata     │
│ created_at   │
│ updated_at   │
└──────────────┘
        │
        │ course_id (FK)
        │
┌──────────────┐
│course_branches│
├──────────────┤
│ id (PK)      │
│ course_id    │────────┐
│ name         │        │
│ code         │        │
│ total_years  │        │
│ semesters... │        │
│ is_active    │        │
│ metadata     │        │
│ created_at   │        │
│ updated_at   │        │
└──────────────┘        │
                         │
                         │ (via course.branch text fields)
                         │
                 ┌──────────────┐
                 │   students   │
                 ├──────────────┤
                 │ id (PK)      │
                 │ course (TXT) │───┐ (legacy text reference)
                 │ branch (TXT) │───┘
                 │ ...          │
                 └──────────────┘

RELATIONSHIP SUMMARY:
- colleges (1) ──< (many) courses
- courses (1) ──< (many) course_branches
- students reference branches via text fields (no FK constraint)
```

---

## 3. Migration Strategy

### 3.1 Migration Overview

**Goal**: Zero-downtime migration with data integrity preservation

**Phases:**
1. Create colleges table
2. Insert default colleges
3. Add nullable `college_id` to courses
4. Map existing courses to colleges
5. Verify data integrity
6. Set NOT NULL constraint
7. Update indexes

### 3.2 Migration Script Structure

#### Step 1: Create Colleges Table

```sql
-- Migration: Add Colleges Support
-- File: backend/scripts/migration_add_colleges.sql
-- Phase: 1 - Create table

USE student_database;

-- Create colleges table
CREATE TABLE IF NOT EXISTS colleges (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_college_name (name),
  UNIQUE KEY unique_college_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### Step 2: Insert Default Colleges

```sql
-- Phase: 2 - Insert default colleges

INSERT INTO colleges (name, code, is_active) VALUES
  ('Pydah College of Engineering', 'PCE', TRUE),
  ('Pydah Degree College', 'PDC', TRUE),
  ('Pydah College of Pharmacy', 'PCP', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);
```

#### Step 3: Add college_id Column (Nullable)

```sql
-- Phase: 3 - Add college_id column (nullable)

ALTER TABLE courses 
  ADD COLUMN college_id INT NULL AFTER id;

-- Add index for performance
CREATE INDEX idx_courses_college_id ON courses(college_id);

-- Add foreign key constraint (with SET NULL on delete)
ALTER TABLE courses 
  ADD CONSTRAINT fk_course_college 
    FOREIGN KEY (college_id) REFERENCES colleges(id) 
    ON DELETE SET NULL;
```

#### Step 4: Map Existing Courses to Colleges

```sql
-- Phase: 4 - Auto-assign courses to colleges based on name matching

-- Map B.Tech and Diploma to Engineering College
UPDATE courses 
SET college_id = (SELECT id FROM colleges WHERE name = 'Pydah College of Engineering' LIMIT 1)
WHERE name IN ('B.Tech', 'Diploma')
  AND college_id IS NULL;

-- Map Degree to Degree College
UPDATE courses 
SET college_id = (SELECT id FROM colleges WHERE name = 'Pydah Degree College' LIMIT 1)
WHERE name = 'Degree'
  AND college_id IS NULL;

-- Map Pharmacy to Pharmacy College
UPDATE courses 
SET college_id = (SELECT id FROM colleges WHERE name = 'Pydah College of Pharmacy' LIMIT 1)
WHERE name = 'Pharmacy'
  AND college_id IS NULL;

-- Verify all courses are mapped
SELECT 
  c.id,
  c.name AS course_name,
  c.college_id,
  cl.name AS college_name
FROM courses c
LEFT JOIN colleges cl ON c.college_id = cl.id
WHERE c.college_id IS NULL;
```

#### Step 5: Set NOT NULL Constraint (After Verification)

```sql
-- Phase: 5 - Set NOT NULL constraint (ONLY after verification)

-- First, ensure all courses have a college_id
-- If any NULLs exist, assign to default college (Engineering)
UPDATE courses 
SET college_id = (SELECT id FROM colleges WHERE name = 'Pydah College of Engineering' LIMIT 1)
WHERE college_id IS NULL;

-- Now set NOT NULL
ALTER TABLE courses 
  MODIFY COLUMN college_id INT NOT NULL;
```

#### Step 6: Verification Queries

```sql
-- Verification: Check data integrity

-- 1. All courses should have college_id
SELECT COUNT(*) AS unmapped_courses
FROM courses 
WHERE college_id IS NULL;
-- Expected: 0

-- 2. All branches should still reference valid courses
SELECT COUNT(*) AS orphaned_branches
FROM course_branches cb
LEFT JOIN courses c ON cb.course_id = c.id
WHERE c.id IS NULL;
-- Expected: 0

-- 3. Student data should remain intact
SELECT 
  COUNT(*) AS total_students,
  COUNT(DISTINCT course) AS unique_courses,
  COUNT(DISTINCT branch) AS unique_branches
FROM students;
-- Should match pre-migration counts

-- 4. College-course mapping summary
SELECT 
  cl.name AS college_name,
  COUNT(c.id) AS course_count,
  COUNT(CASE WHEN c.is_active = TRUE THEN 1 END) AS active_courses
FROM colleges cl
LEFT JOIN courses c ON cl.id = c.college_id
GROUP BY cl.id, cl.name
ORDER BY cl.name;
```

### 3.3 Rollback Script

```sql
-- Rollback: Remove Colleges Support
-- File: backend/scripts/migration_rollback_colleges.sql
-- WARNING: Only run if migration needs to be reversed

USE student_database;

-- Step 1: Remove foreign key constraint
ALTER TABLE courses 
  DROP FOREIGN KEY fk_course_college;

-- Step 2: Remove index
DROP INDEX idx_courses_college_id ON courses;

-- Step 3: Remove college_id column
ALTER TABLE courses 
  DROP COLUMN college_id;

-- Step 4: (Optional) Drop colleges table if needed
-- DROP TABLE IF EXISTS colleges;
```

### 3.4 Migration Execution Plan

**Pre-Migration Checklist:**
- [ ] Backup database
- [ ] Test migration on staging environment
- [ ] Verify all existing courses exist
- [ ] Document current course names
- [ ] Schedule maintenance window (if needed)

**Migration Steps:**
1. Run Step 1 (Create table) - ~1 second
2. Run Step 2 (Insert defaults) - ~1 second
3. Run Step 3 (Add column) - ~5-30 seconds (depends on table size)
4. Run Step 4 (Map courses) - ~1-5 seconds
5. Verify with Step 6 queries
6. Run Step 5 (NOT NULL) - ~5-30 seconds

**Post-Migration:**
- [ ] Verify all courses mapped
- [ ] Test API endpoints
- [ ] Verify frontend integration
- [ ] Monitor for errors

**Estimated Downtime**: 0 seconds (all operations are non-blocking)

---

## 4. Backend API Design

### 4.1 New Routes: Colleges

**File**: `backend/routes/collegeRoutes.js` (NEW)

```javascript
const express = require('express');
const router = express.Router();
const collegeController = require('../controllers/collegeController');
const authMiddleware = require('../middleware/auth');

// Public route (if needed for forms)
// router.get('/options', collegeController.getCollegeOptions);

// All routes below require admin authentication
router.use(authMiddleware);

// College CRUD
router.get('/', collegeController.getColleges);
router.post('/', collegeController.createCollege);
router.get('/:collegeId', collegeController.getCollege);
router.put('/:collegeId', collegeController.updateCollege);
router.delete('/:collegeId', collegeController.deleteCollege);

// College courses
router.get('/:collegeId/courses', collegeController.getCollegeCourses);

module.exports = router;
```

**Server Registration** (in `backend/server.js`):
```javascript
const collegeRoutes = require('./routes/collegeRoutes');
app.use('/api/colleges', collegeRoutes);
```

### 4.2 Updated Routes: Courses

**File**: `backend/routes/courseRoutes.js` (UPDATE)

```javascript
// Existing routes remain, with additions:

// GET /courses?collegeId=123 - Filter by college
router.get('/', courseController.getCourses); // Updated to support collegeId query

// POST /courses - Now requires collegeId in body
router.post('/', courseController.createCourse); // Updated to require collegeId
```

### 4.3 API Endpoint Specifications

#### 4.3.1 Colleges Endpoints

**GET /api/colleges**
- **Description**: Get all colleges
- **Query Params**: 
  - `includeInactive` (boolean, default: false)
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Pydah College of Engineering",
      "code": "PCE",
      "isActive": true,
      "metadata": null,
      "createdAt": "2025-01-XX...",
      "updatedAt": "2025-01-XX..."
    }
  ]
}
```

**POST /api/colleges**
- **Description**: Create new college
- **Body**:
```json
{
  "name": "New College Name",
  "code": "NCC", // optional
  "isActive": true // optional, default: true
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": 4,
    "name": "New College Name",
    ...
  }
}
```

**GET /api/colleges/:collegeId**
- **Description**: Get single college by ID
- **Response**: Same as GET /api/colleges item

**PUT /api/colleges/:collegeId**
- **Description**: Update college
- **Body**: Same as POST (all fields optional)
- **Response**: Updated college object

**DELETE /api/colleges/:collegeId**
- **Description**: Soft delete college (sets isActive = false)
- **Query Params**: 
  - `hard` (boolean, default: false) - if true, hard delete
- **Response**:
```json
{
  "success": true,
  "message": "College deleted successfully"
}
```

**GET /api/colleges/:collegeId/courses**
- **Description**: Get all courses for a college
- **Query Params**: 
  - `includeInactive` (boolean, default: false)
- **Response**: Array of course objects

#### 4.3.2 Updated Courses Endpoints

**GET /api/courses**
- **Updated Query Params**:
  - `collegeId` (integer, optional) - Filter courses by college
  - `includeInactive` (boolean, default: false)
- **Response**: Array of course objects (now includes `collegeId`)

**POST /api/courses**
- **Updated Body** (now requires `collegeId`):
```json
{
  "name": "B.Tech",
  "collegeId": 1, // REQUIRED
  "totalYears": 4,
  "semestersPerYear": 2,
  "isActive": true
}
```

**PUT /api/courses/:courseId**
- **Updated Body** (can update `collegeId`):
```json
{
  "name": "Updated Name",
  "collegeId": 2, // Can change college
  "totalYears": 4
}
```

### 4.4 Controller Structure (Design Only)

#### 4.4.1 New Controller: `collegeController.js`

**Functions to implement:**
```javascript
// GET /api/colleges
exports.getColleges = async (req, res) => { ... }

// GET /api/colleges/:collegeId
exports.getCollege = async (req, res) => { ... }

// POST /api/colleges
exports.createCollege = async (req, res) => { ... }

// PUT /api/colleges/:collegeId
exports.updateCollege = async (req, res) => { ... }

// DELETE /api/colleges/:collegeId
exports.deleteCollege = async (req, res) => { ... }

// GET /api/colleges/:collegeId/courses
exports.getCollegeCourses = async (req, res) => { ... }
```

#### 4.4.2 Updated Controller: `courseController.js`

**Functions to update:**
```javascript
// GET /api/courses - Add collegeId filtering
exports.getCourses = async (req, res) => { ... }

// POST /api/courses - Require collegeId
exports.createCourse = async (req, res) => { ... }

// PUT /api/courses/:courseId - Allow collegeId update
exports.updateCourse = async (req, res) => { ... }
```

---

## 5. Service Layer Structure

### 5.1 New Service: `collegeService.js`

**File**: `backend/services/collegeService.js` (NEW)

**Functions:**
```javascript
// Fetch all colleges
async function fetchColleges(options = {}) {
  // includeInactive: boolean
  // Returns: Array of college objects
}

// Fetch single college by ID
async function fetchCollegeById(collegeId) {
  // Returns: College object or null
}

// Create new college
async function createCollege(collegeData) {
  // collegeData: { name, code?, isActive? }
  // Returns: Created college object
}

// Update college
async function updateCollege(collegeId, updates) {
  // updates: Partial college object
  // Returns: Updated college object
}

// Delete college (soft or hard)
async function deleteCollege(collegeId, options = {}) {
  // options: { hard: boolean }
  // Returns: Success status
}

// Get courses for a college
async function getCollegeCourses(collegeId, options = {}) {
  // options: { includeInactive: boolean }
  // Returns: Array of course objects
}

// Validate college exists
async function validateCollegeExists(collegeId) {
  // Returns: boolean
}
```

### 5.2 Updated Service: `courseService.js` (if exists) or in `courseController.js`

**Functions to add/update:**
```javascript
// Fetch courses with college filtering
async function fetchCourses(options = {}) {
  // options: { collegeId?, includeInactive? }
  // Returns: Array of course objects with college info
}

// Create course with college validation
async function createCourse(courseData) {
  // courseData: { name, collegeId, totalYears, ... }
  // Validates collegeId exists
  // Returns: Created course object
}

// Update course (can change college)
async function updateCourse(courseId, updates) {
  // updates: { name?, collegeId?, ... }
  // Validates collegeId if provided
  // Returns: Updated course object
}
```

### 5.3 Service: `branchService.js` (if exists)

**No changes required** - branches continue to work as before.

---

## 6. Frontend Integration Plan

### 6.1 Current State (Phase 1)

The frontend currently uses:
- **Mocked colleges** in `COLLEGE_COURSE_MAPPING` constant
- **Client-side filtering** of courses by college
- **Hardcoded default colleges** in `DEFAULT_COLLEGES`

### 6.2 Migration Steps

#### Step 1: Update API Configuration

**File**: `frontend/src/pages/Settings.jsx`

**Remove hardcoded data:**
```javascript
// REMOVE:
const COLLEGE_COURSE_MAPPING = { ... };
const DEFAULT_COLLEGES = [ ... ];
```

**Add API functions:**
```javascript
// ADD:
const fetchColleges = async ({ silent = false } = {}) => {
  try {
    if (!silent) setLoading(true);
    const response = await api.get('/colleges?includeInactive=true');
    const collegeData = response.data.data || [];
    setColleges(collegeData);
    return collegeData;
  } catch (error) {
    console.error('Failed to fetch colleges', error);
    toast.error(error.response?.data?.message || 'Failed to fetch colleges');
    return [];
  } finally {
    if (!silent) setLoading(false);
  }
};

const createCollegeAPI = async (collegeData) => {
  const response = await api.post('/colleges', collegeData);
  return response.data.data;
};

const updateCollegeAPI = async (collegeId, updates) => {
  const response = await api.put(`/colleges/${collegeId}`, updates);
  return response.data.data;
};

const deleteCollegeAPI = async (collegeId, hard = false) => {
  const response = await api.delete(`/colleges/${collegeId}`, {
    params: { hard }
  });
  return response.data;
};
```

#### Step 2: Update College Management Functions

**Replace mocked functions with API calls:**

```javascript
// BEFORE (mocked):
const handleCreateCollege = async (event) => {
  // ... creates local state only
};

// AFTER (API):
const handleCreateCollege = async (event) => {
  event.preventDefault();
  if (!newCollege.name.trim()) {
    toast.error('College name is required');
    return;
  }

  try {
    setCreatingCollege(true);
    const createdCollege = await createCollegeAPI({
      name: newCollege.name.trim(),
      isActive: newCollege.isActive
    });
    toast.success('College created successfully');
    setNewCollege({ name: '', isActive: true });
    await fetchColleges({ silent: true });
    setSelectedCollegeId(createdCollege.id);
  } catch (error) {
    console.error('Failed to create college', error);
    toast.error(error.response?.data?.message || 'Failed to create college');
  } finally {
    setCreatingCollege(false);
  }
};
```

#### Step 3: Update Course Filtering

**Replace client-side mapping with API filtering:**

```javascript
// BEFORE:
const coursesForSelectedCollege = useMemo(() => {
  const selectedCollege = colleges.find(c => c.id === selectedCollegeId);
  const collegeCourseNames = COLLEGE_COURSE_MAPPING[selectedCollege.name] || [];
  return courses.filter(course => collegeCourseNames.includes(course.name));
}, [courses, selectedCollegeId, colleges]);

// AFTER:
const coursesForSelectedCollege = useMemo(() => {
  if (!selectedCollegeId) return [];
  return courses.filter(course => course.collegeId === selectedCollegeId);
}, [courses, selectedCollegeId]);
```

**Update fetchCourses to support college filtering:**

```javascript
// BEFORE:
const fetchCourses = async ({ silent = false } = {}) => {
  const response = await api.get('/courses?includeInactive=true');
  // ...
};

// AFTER:
const fetchCourses = async ({ silent = false, collegeId = null } = {}) => {
  const params = { includeInactive: true };
  if (collegeId) params.collegeId = collegeId;
  const response = await api.get('/courses', { params });
  // ...
};
```

#### Step 4: Update Course Creation

**Add collegeId to course creation:**

```javascript
// BEFORE:
const handleCreateCourse = async (event) => {
  // ...
  await api.post('/courses', {
    name: newCourse.name.trim(),
    totalYears: Number(newCourse.totalYears),
    // ...
  });
};

// AFTER:
const handleCreateCourse = async (event) => {
  if (!selectedCollegeId) {
    toast.error('Please select a college first');
    return;
  }
  // ...
  await api.post('/courses', {
    name: newCourse.name.trim(),
    collegeId: selectedCollegeId, // ADD THIS
    totalYears: Number(newCourse.totalYears),
    // ...
  });
};
```

#### Step 5: Update useEffect Hooks

**Fetch colleges on mount:**

```javascript
useEffect(() => {
  fetchColleges(); // ADD THIS
  fetchCourses();
  // Auto-select first college on mount
  // (will be handled by separate useEffect)
}, []);

useEffect(() => {
  if (colleges.length > 0 && !selectedCollegeId) {
    setSelectedCollegeId(colleges[0].id);
  }
}, [colleges, selectedCollegeId]);
```

### 6.3 Testing Checklist

- [ ] Colleges load from API
- [ ] Create college works
- [ ] Edit college works
- [ ] Delete college works
- [ ] Courses filter by selected college
- [ ] Course creation includes collegeId
- [ ] Branches continue to work
- [ ] Student data remains intact

---

## 7. Rollback Plan

### 7.1 Database Rollback

**If migration fails:**

1. **Run rollback script** (see Section 3.3)
2. **Verify data integrity:**
   ```sql
   SELECT COUNT(*) FROM courses; -- Should match pre-migration
   SELECT COUNT(*) FROM course_branches; -- Should match pre-migration
   SELECT COUNT(*) FROM students; -- Should match pre-migration
   ```

### 7.2 Code Rollback

**If backend changes cause issues:**

1. **Revert controller changes** (git revert)
2. **Remove college routes** from server.js
3. **Frontend automatically falls back** to mocked data (if code not updated)

### 7.3 Frontend Rollback

**If frontend integration fails:**

1. **Revert Settings.jsx** to Phase 1 version
2. **Frontend will use mocked colleges** until backend is ready

### 7.4 Data Recovery

**If data corruption occurs:**

1. **Restore from backup** (taken before migration)
2. **Re-run migration** after fixing issues

---

## 8. Implementation Checklist

### Phase 2 (Current - Design Only)
- [x] Database schema design
- [x] ER diagram
- [x] Migration scripts designed
- [x] API structure designed
- [x] Service layer planned
- [x] Frontend integration plan
- [x] Rollback plan

### Phase 3 (Awaiting Approval)
- [ ] Create migration script file
- [ ] Test migration on staging
- [ ] Implement collegeController.js
- [ ] Update courseController.js
- [ ] Create collegeService.js
- [ ] Update courseService.js (if exists)
- [ ] Add college routes
- [ ] Update frontend API calls
- [ ] Test end-to-end
- [ ] Deploy to production

---

## 9. Notes & Considerations

### 9.1 Data Integrity

- **Students table unchanged**: No FK constraints, maintains backward compatibility
- **Branches unchanged**: Continue to reference courses
- **Courses**: New optional relationship to colleges

### 9.2 Performance

- **Indexes added**: `idx_courses_college_id` for fast filtering
- **Query optimization**: JOIN queries for college-course relationships

### 9.3 Backward Compatibility

- **Legacy course names**: Still work via text matching
- **Student data**: No changes required
- **API**: Existing endpoints continue to work (with optional collegeId)

### 9.4 Future Enhancements

- **College metadata**: JSON field for extensibility
- **College codes**: For reporting and exports
- **Multi-college support**: Ready for expansion

---

## 10. Approval Required

**This document is a DESIGN PLAN only. No code has been implemented.**

**Next Steps:**
1. Review this plan
2. Approve or request changes
3. Once approved, proceed to Phase 3 (Implementation)

**Questions or Concerns?**
- Review migration strategy
- Verify data mapping logic
- Confirm API design
- Check rollback procedures

---

**END OF PHASE 2 DESIGN DOCUMENT**

