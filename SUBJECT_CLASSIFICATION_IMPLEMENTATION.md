# Subject Classification System Implementation

## Overview
Implemented a comprehensive subject classification system that distinguishes between **Theory** and **Lab** subjects, with specific metadata for each type. This system is fully integrated into the feedback workflow.

## Database Changes

### Subjects Table Structure
The `subjects` table now includes:

| Column | Type | Description |
|--------|------|-------------|
| `subject_type` | ENUM('theory', 'lab') | Classification of the subject |
| `units` | INT | Number of units (for theory subjects) |
| `experiments_count` | INT | Number of experiments (for lab subjects) |
| `credits` | DECIMAL(3,1) | Credit hours for the subject |

**Validation Rules:**
- Theory subjects **must** have `units` specified
- Lab subjects **must** have `experiments_count` specified
- When changing subject type, the opposite field is automatically cleared

## Backend Updates

### 1. Subjects Controller (`subjectsController.js`)

**Enhanced Features:**
- ✅ Create subjects with type classification
- ✅ Automatic validation based on subject type
- ✅ Update subject type with automatic field clearing
- ✅ List subjects with all classification details

**API Endpoints:**
```javascript
GET    /api/subjects          // List all subjects with type info
POST   /api/subjects          // Create subject (validates type-specific fields)
PUT    /api/subjects/:id      // Update subject
DELETE /api/subjects/:id      // Delete subject
```

**Request Body Example (Create Theory Subject):**
```json
{
  "college_id": 1,
  "course_id": 2,
  "branch_id": 3,
  "name": "Data Structures",
  "code": "CS201",
  "subject_type": "theory",
  "units": 4,
  "credits": 3.0
}
```

**Request Body Example (Create Lab Subject):**
```json
{
  "college_id": 1,
  "course_id": 2,
  "branch_id": 3,
  "name": "Data Structures Lab",
  "code": "CS201L",
  "subject_type": "lab",
  "experiments_count": 12,
  "credits": 1.5
}
```

### 2. Feedback Controller (`feedbackController.js`)

**Updated Functions:**

#### `getMyPendingFeedback`
Now returns subject classification details:
```javascript
{
  subjectId: 1,
  subjectName: "Data Structures",
  subjectCode: "CS201",
  subjectType: "theory",        // NEW
  units: 4,                      // NEW
  experimentsCount: null,        // NEW
  credits: 3.0,                  // NEW
  facultyId: 5,
  facultyName: "Dr. John Smith",
  isSubmitted: false,
  formId: "form_123",
  formName: "Academic Feedback",
  questions: [...]
}
```

## Frontend Updates

### 1. Student Feedback Page (`StudentFeedback.jsx`)

**Visual Enhancements:**

#### Subject Type Badges
- **Theory Subjects**: Blue badge with 📚 icon
- **Lab Subjects**: Purple badge with 🧪 icon

#### Additional Information
- **Theory**: Green badge showing number of units (e.g., "4 Units")
- **Lab**: Orange badge showing experiment count (e.g., "12 Experiments")

**UI Example:**
```
┌─────────────────────────────────────┐
│  📚                                  │
│                                      │
│  Data Structures                     │
│  CS201  📚 THEORY  4 Units          │
│                                      │
│  👤 Faculty                          │
│     Dr. John Smith                   │
│                                      │
│  [Give Feedback →]                   │
└─────────────────────────────────────┘
```

## Usage Workflow

### For Administrators

1. **Create/Edit Subjects** via subject management
2. **Select Subject Type**: Theory or Lab
3. **Fill Required Fields**:
   - If Theory → Enter number of units
   - If Lab → Enter number of experiments
4. **Optional**: Add credit hours
5. **Save** - Validation ensures correct fields are filled

### For Students

1. **View Pending Feedback** on `/student/feedback`
2. **See Subject Details**:
   - Subject name and code
   - Type badge (Theory/Lab)
   - Units or Experiments count
   - Faculty name
3. **Submit Feedback** - All subject context is automatically included

## Auto-Rendering Logic

The system automatically:

1. **Fetches** student's current subjects based on:
   - Current academic year
   - Current semester
   - Branch enrollment

2. **Displays** subject classification:
   - Shows appropriate badge (Theory/Lab)
   - Displays relevant metadata (units/experiments)
   - Groups by submission status (Pending/Completed)

3. **Tracks** completion:
   - Prevents duplicate submissions
   - Marks submitted feedback
   - Shows completion status

## Benefits

✅ **Clear Subject Classification**: Visual distinction between theory and lab subjects
✅ **Metadata Tracking**: Units and experiments count for better academic management
✅ **Validation**: Ensures data integrity at creation/update
✅ **Student Context**: Students see complete subject information when giving feedback
✅ **Automatic Rendering**: No manual configuration needed - subjects appear automatically based on enrollment

## Files Modified

### Backend:
- `backend/controllers/subjectsController.js` - Enhanced with type validation
- `backend/controllers/feedbackController.js` - Returns subject classification data
- `backend/migrations/add_subject_type_classification.sql` - Database schema update

### Frontend:
- `frontend/src/pages/student/StudentFeedback.jsx` - Displays subject type badges and metadata

## Next Steps (Optional Enhancements)

1. **Subject Management UI**: Create admin interface for managing subjects with type selection
2. **Analytics**: Track feedback separately for theory vs lab subjects
3. **Reports**: Generate completion reports showing units/experiments coverage
4. **Bulk Import**: Allow CSV import of subjects with type classification
