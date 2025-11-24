# Phase 2: College Migration - Quick Reference

**Status**: Design & Planning Phase ✅  
**Full Documentation**: See `PHASE_2_COLLEGE_MIGRATION_PLAN.md`

---

## 📊 Summary

This document provides a quick overview of the backend migration plan for introducing Colleges hierarchy.

### Current Structure
```
Courses → Branches → Students
```

### New Structure
```
Colleges → Courses → Branches → Students
```

---

## 🗄️ Database Changes

### New Table: `colleges`
- `id` (PK)
- `name` (unique)
- `code` (unique, optional)
- `is_active`
- `metadata` (JSON)
- Timestamps

### Updated Table: `courses`
- **NEW**: `college_id` (FK → colleges.id)
- All existing fields unchanged

### Unchanged Tables
- `course_branches` - No changes
- `students` - No changes

---

## 🔄 Migration Steps

1. **Create** `colleges` table
2. **Insert** 3 default colleges:
   - Pydah College of Engineering
   - Pydah Degree College
   - Pydah College of Pharmacy
3. **Add** `college_id` column (nullable)
4. **Map** existing courses:
   - B.Tech, Diploma → Engineering
   - Degree → Degree College
   - Pharmacy → Pharmacy College
5. **Verify** data integrity
6. **Set** NOT NULL constraint

**Estimated Time**: 1-2 minutes  
**Downtime**: 0 seconds (non-blocking)

---

## 🔌 New API Endpoints

### Colleges
- `GET /api/colleges` - List all colleges
- `POST /api/colleges` - Create college
- `GET /api/colleges/:id` - Get college
- `PUT /api/colleges/:id` - Update college
- `DELETE /api/colleges/:id` - Delete college
- `GET /api/colleges/:id/courses` - Get college courses

### Updated Courses
- `GET /api/courses?collegeId=123` - Filter by college
- `POST /api/courses` - Now requires `collegeId` in body
- `PUT /api/courses/:id` - Can update `collegeId`

---

## 📁 New Files to Create

### Backend
- `backend/routes/collegeRoutes.js` (NEW)
- `backend/controllers/collegeController.js` (NEW)
- `backend/services/collegeService.js` (NEW)

### Migration Scripts
- `backend/scripts/migration_add_colleges.sql` ✅ (created)
- `backend/scripts/migration_rollback_colleges.sql` ✅ (created)

---

## 🔧 Files to Update

### Backend
- `backend/routes/courseRoutes.js` - Add collegeId filtering
- `backend/controllers/courseController.js` - Require collegeId
- `backend/server.js` - Register college routes

### Frontend
- `frontend/src/pages/Settings.jsx` - Replace mocked data with API calls

---

## ✅ Data Integrity Guarantees

- ✅ No student data changes
- ✅ No branch data changes
- ✅ All existing courses preserved
- ✅ Zero-downtime migration
- ✅ Full rollback capability

---

## 🚦 Implementation Phases

### Phase 2 (Current) ✅
- [x] Design database schema
- [x] Design API structure
- [x] Create migration scripts
- [x] Plan service layer
- [x] Plan frontend integration

### Phase 3 (Awaiting Approval)
- [ ] Run migration on staging
- [ ] Implement backend controllers
- [ ] Update frontend API calls
- [ ] Test end-to-end
- [ ] Deploy to production

---

## ⚠️ Important Notes

1. **DO NOT EXECUTE** migration scripts until approved
2. **Test on staging** first
3. **Backup database** before migration
4. **Verify data** after migration
5. **Rollback plan** available if needed

---

## 📞 Next Steps

1. Review `PHASE_2_COLLEGE_MIGRATION_PLAN.md`
2. Review migration scripts
3. Approve or request changes
4. Proceed to Phase 3 (Implementation)

---

**Last Updated**: 2025-01-XX

