# Pydah Student Portal – Version 2.0 Implementation Plan

## Overview

Version 2.0 focuses on **faculty-driven academics** and **real-time collaboration**, extending the existing portal with:

- **Faculty Management System** (admin-controlled, role-based)
- **Hourly attendance** posting by faculty
- **Academic content**: notes, assignments, tests, results
- **Structured communication**: subject-wise, club, and event group chats
- **Student academic dashboard**: attendance %, internal marks, upcoming tests, notes, notifications
- **Faculty Portal**: attendance, content uploads, test management, announcements, student interaction
- **Admin enhancements**: faculty control, attendance monitoring, academic reports, moderation

All features use **role-based access control**, are **multi-college scalable**, **PWA-compatible**, **audit-friendly**, and integrate with existing registration, fees, transport, tickets, clubs, and notifications.

---

## Architecture Summary

| Layer | Technology |
|-------|------------|
| Backend | Express.js, MySQL (master + staging), existing RBAC |
| Frontend | React (Vite), existing Admin + Student layouts |
| New user type | Faculty (RBAC role `faculty` with scope college/course/branch) |
| Real-time | REST + polling first; WebSocket-ready for chats |

---

## Phase 1: Database & Faculty Foundation

### 1.1 New Tables (Migration: `pydah_v2_faculty_and_academics.sql`)

- **period_slots** – Configurable hourly/period slots per college (e.g. P1 9–10, P2 10–11).
- **hourly_attendance_records** – Per-student, per-date, per-period attendance (faculty-posted).
- **subjects** – Subjects per course/branch/college for content and subject chats.
- **faculty_subjects** – Links faculty (rbac_users.id) to subjects they teach.
- **academic_content** – Notes, assignments, tests (type, title, file_url, subject, due_date, max_marks, etc.).
- **content_submissions** – Student submissions for assignments/tests (file_url, marks, submitted_at).
- **internal_marks** – Internal marks per student/subject/semester (internal1, internal2, assignment).
- **chat_channels** – Channels of type subject/club/event with subject_id, club_id, or event_id.
- **chat_channel_members** – Membership (student/faculty/admin) for each channel.
- **chat_messages** – Messages with sender_type, sender_id, moderation fields (moderated_at, is_hidden).
- **audit_log_academic** – Optional audit trail for academic actions (who posted attendance, content, etc.).

### 1.2 RBAC Updates

- Add role **`faculty`** in backend `constants/rbac.js` and `ROLE_REQUIREMENTS` (college/course/branch scope).
- New modules: **`faculty_management`** (admin), **`faculty_academics`** (faculty: attendance, content, tests, announcements, student interaction).
- Permissions:
  - **faculty_management**: view, create, edit, deactivate, assign_subjects (admin only).
  - **faculty_academics**: view_attendance, post_attendance, view_content, upload_content, manage_tests, post_announcements, view_students, moderate_chat (for faculty).

### 1.3 Backend Routes (New)

- **Faculty management** (admin): `GET/POST /api/faculty`, `GET/PUT/DELETE /api/faculty/:id`, `PUT /api/faculty/:id/subjects`.
- **Period slots** (admin/faculty): `GET/POST /api/period-slots`, `PUT/DELETE /api/period-slots/:id`.
- **Hourly attendance**: `POST /api/hourly-attendance` (faculty post), `GET /api/hourly-attendance` (list by date/course/branch/slot), `GET /api/hourly-attendance/student/:studentId` (student view).
- **Academic content**: `GET/POST /api/academic-content`, `GET/PUT/DELETE /api/academic-content/:id`, `POST /api/academic-content/:id/submit` (student submission).
- **Internal marks**: `GET/POST/PUT /api/internal-marks` (faculty/admin).
- **Chat**: `GET /api/chat/channels`, `GET /api/chat/channels/:id/messages`, `POST /api/chat/channels/:id/messages`, `PATCH /api/chat/messages/:id/moderate` (moderation).

---

## Phase 2: Hourly Attendance

- **Faculty**: UI to select date, period slot, course/branch/section, then mark present/absent per student (or bulk). Uses existing student list scoped by college/course/branch.
- **Student**: Academic dashboard shows daily + period-wise attendance and **attendance percentage** (derived from hourly or existing daily logic).
- **Admin**: Attendance monitoring (view by date/college/course/branch/faculty), reports (hourly vs daily), export. Integrate with existing attendance reports where applicable.

---

## Phase 3: Academic Content & Student Academic Dashboard

- **Faculty**: Upload notes (files), create assignments (title, description, due date, file), create tests (title, max marks, due date); post results (marks) for tests/assignments.
- **Student**: Academic dashboard shows:
  - Attendance percentage (from Phase 2).
  - Internal marks (from internal_marks + content_submissions).
  - Upcoming tests and assignments (from academic_content).
  - Shared notes (links/downloads).
  - Academic notifications (from existing notification system, tagged as “academic”).
- **Admin**: View/report on content and results; no direct edit required initially (faculty-owned).

---

## Phase 4: Chats & Moderation

- **Channel types**: Subject (linked to subject_id), Club (linked to club_id), Event (linked to event_id).
- **Members**: Auto-add students (by subject/course/branch, club membership, event registration); faculty and admins can be added.
- **Messaging**: REST CRUD for messages; optional WebSocket later for “real-time” feel.
- **Moderation**: Admin/faculty can hide/flag messages; audit fields (moderated_at, is_hidden).

---

## Phase 5: Faculty Portal UI

- **Faculty layout** (similar to AdminLayout): sidebar with Faculty Dashboard, Post Attendance, My Content (notes/assignments/tests), Announcements, Students, Chats.
- **Auth**: Same unified login; if `user.role === 'faculty'`, redirect to `/faculty/dashboard`. Faculty can only access faculty routes (middleware).
- **PWA**: Reuse existing PWA setup (service worker, install prompt) for faculty and student.

---

## Phase 6: Admin Panel Enhancements

- **Faculty control**: List/create/edit/deactivate faculty; assign colleges/courses/branches and subjects (faculty_subjects).
- **Attendance monitoring**: Filters by date, college, course, branch, faculty; hourly vs daily summary; export.
- **Academic reports**: Content usage, test/assignment completion, internal marks summary; export.
- **Moderation**: List chat channels, open channel, hide/restore messages, audit log.

---

## Faculty Workflow: Principal → HOD → Faculty

**Hierarchy (create in this order):** Super Admin → **Principals & AOs** → **HOD (per branch)** → **Faculty**.

- **HOD must be created first** for each branch (or multiple branches); then **Faculty** are created under that HOD and assigned to **subjects**.
- **Faculty Management** should:
  1. **Show Principals** (and under them) **HODs per branch** and **Faculty** under each HOD.
  2. Allow **assigning HOD** for each branch (via User Management: role = Branch HOD, scope = branch).
  3. Let **HOD** (or admin) **upload subjects** per semester for the branch; then **create Faculty** users and **assign subjects** to them (existing APIs).
  4. Let **HOD** create the **semester timetable** for the week (**6 days, Monday–Saturday**), using period slots and assigning subject + faculty per slot.

See **FACULTY_WORKFLOW_AND_HIERARCHY.md** for full workflow, RBAC reference, and implementation gaps (e.g. timetable table and UI).

---

## Integration with Existing Systems

| System | Integration |
|--------|-------------|
| Student registration | Students from master DB; faculty sees only approved/regular students in their scope. |
| Fees | No change; student dashboard keeps existing fee link. |
| Transport | No change; student dashboard keeps transport link. |
| Tickets | No change; faculty can have “raise ticket” in portal if desired. |
| Clubs | Club chats use existing `clubs` table; club_members from clubs.members JSON or derived. |
| Notifications | New “academic” notification type for test/assignment due, result published, etc.; use existing notification service. |

---

## Audit & Scalability

- **Audit**: All faculty actions (attendance post, content upload, result post, message hide) can be written to `audit_log_academic` or existing `audit_logs` with entity_type = 'hourly_attendance', 'academic_content', 'chat_message'.
- **Multi-college**: All new tables scoped by college_id (and course_id/branch_id where applicable); faculty and admin queries filter by user scope.
- **PWA**: Existing manifest and service worker; ensure faculty and student routes are cached for offline-ready UX.

---

## File Structure (New/Modified)

```
backend/
  migrations/
    pydah_v2_faculty_and_academics.sql
  constants/
    rbac.js                          (add faculty role, faculty_management, faculty_academics)
  controllers/
    facultyController.js             (NEW)
    hourlyAttendanceController.js    (NEW)
    academicContentController.js     (NEW)
    internalMarksController.js       (NEW)
    chatController.js                (NEW)
    periodSlotsController.js         (NEW)
  routes/
    facultyRoutes.js                 (NEW)
    hourlyAttendanceRoutes.js       (NEW)
    academicContentRoutes.js         (NEW)
    internalMarksRoutes.js           (NEW)
    chatRoutes.js                    (NEW)
    periodSlotsRoutes.js             (NEW)
  server.js                          (mount new routes)

frontend/
  src/
    constants/
      rbac.js                        (add faculty role, modules, routes)
    components/
      Layout/
        FacultyLayout.jsx            (NEW)
    pages/
      faculty/                       (NEW folder)
        Dashboard.jsx
        PostAttendance.jsx
        ContentManage.jsx
        TestsManage.jsx
        Announcements.jsx
        Students.jsx
        Chats.jsx
      student/
        Dashboard.jsx                (extend with academic dashboard)
        AcademicDashboard.jsx        (NEW – or merge into Dashboard)
      admin/
        FacultyManagement.jsx        (NEW)
        AttendanceMonitoring.jsx     (NEW)
        AcademicReports.jsx          (NEW)
        ChatModeration.jsx           (NEW)
  App.jsx                            (add faculty routes, ProtectedFacultyRoute)
```

---

## Implementation Order (Checklist)

1. [x] Implementation plan (this document)
2. [x] Run migration `pydah_v2_faculty_and_academics.sql` (runs on server start via `runMigrations`; or run `node backend/scripts/run_v2_migration.js`)
3. [x] Backend: RBAC faculty role + modules
4. [x] Backend: Faculty CRUD + period slots + hourly attendance APIs
5. [x] Backend: Academic content + internal marks + chat APIs
6. [x] Frontend: Faculty layout + dashboard + post attendance + content
7. [x] Frontend: Student academic dashboard (attendance %, marks, tests, notes)
8. [x] Frontend: Admin faculty management + attendance monitoring (academic reports + chat moderation UI optional next)
9. [ ] Notifications: Academic notification types and triggers
10. [ ] PWA & audit pass

---

## Quick reference – New API endpoints (v2.0)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/faculty` | GET | List faculty (scope) |
| `/api/faculty/:id` | GET | Get faculty + subjects |
| `/api/faculty/:id/subjects` | PUT | Assign subjects `{ subjectIds: [] }` |
| `/api/period-slots` | GET, POST, PUT, DELETE | Period slots by college |
| `/api/subjects` | GET, POST, PUT, DELETE | Subjects by college/course |
| `/api/hourly-attendance` | GET, POST | List by date; post entries |
| `/api/hourly-attendance/students` | GET | Students for marking (course, branch, batch) |
| `/api/hourly-attendance/student-summary` | GET | Student’s attendance % (student only) |
| `/api/hourly-attendance/student/:id` | GET | Student’s hourly records (or `student/me`) |
| `/api/academic-content` | GET, POST | List; create note/assignment/test |
| `/api/academic-content/:id` | GET, PUT, DELETE | Get/update/delete |
| `/api/academic-content/:id/submit` | POST | Student submit (file_url, marks) |
| `/api/internal-marks` | GET, POST | List; upsert marks |
| `/api/internal-marks/student/me` | GET | Current student’s marks |
| `/api/chat/channels` | GET | List channels |
| `/api/chat/channels` | POST | Create channel (admin/faculty) |
| `/api/chat/channels/:id/messages` | GET, POST | Messages; post message |
| `/api/chat/messages/:id/moderate` | PATCH | Hide/restore `{ is_hidden }` |

---

*Document version: 1.1 – Pydah Student Portal v2.0*
