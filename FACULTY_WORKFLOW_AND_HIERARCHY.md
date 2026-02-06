# Faculty Workflow and Role Hierarchy

## 1. Role Hierarchy (Top to Bottom)

The system follows a strict creation and reporting order:

| Level | Role(s) | Who Creates | Scope |
|-------|---------|-------------|--------|
| 1 | **Super Admin** | — | All colleges, all data |
| 2 | **College Principal**, **College AO** | Super Admin | College(s), courses, branches (configurable) |
| 3 | **Branch HOD** (Head of Department) | Super Admin, Principal, or AO | One or more **branches** under a course |
| 4 | **Faculty** | Super Admin, Principal, AO, or **HOD** | Course/branch; assigned to **subjects** |

**Rule:** HOD must be created **before** faculty for that branch. Faculty work **under** the HOD of their branch.

---

## 2. Creation Order (Workflow)

1. **Super Admin** creates **Principals** and **AOs** and assigns college/course/branch scope.
2. **Principal / AO** (or Super Admin) creates **HOD(s)** for each **branch** (or multiple branches).
3. **HOD** (or Principal/AO) creates **Faculty** users and assigns them to **subjects**.
4. **HOD** leads **semester timetable** (weekly schedule, 6 days Mon–Sat).

So: **Create HOD for the course/branch first → then create Faculty under that HOD.**

---

## 3. Faculty Management – Intended Workflow

The **Faculty Management** section should support this flow:

### 3.1 Show Principals (and structure under them)

- List **Principals** (and optionally AOs) with their assigned colleges.
- Under each Principal: show **HODs** assigned to branches under that college/course.
- Under each HOD: show **Faculty** and their assigned **subjects**.

### 3.2 Assign HOD per Branch

- For each **branch** (or multiple branches), assign a **HOD** (rbac user with role `branch_hod`).
- HOD scope: college + course + branch(es). Done via **User Management** (create user, role = Branch HOD, set branch).

### 3.3 HOD: Subjects per Semester

- **HOD** (or admin with scope) uploads/manages **subjects** for each **semester** for their branch/course.
- Subjects are already scoped by college, course, branch (`subjects` table: `college_id`, `course_id`, `branch_id`).
- Optionally link subjects to **semester** (e.g. semester 1, 2) if the schema supports it.

### 3.4 Create Faculty for a Subject

- In **User Management**, create a user with role **Faculty**.
- Assign scope: college, course, branch (and optionally “all branches” for that course).
- In **Faculty Management**, assign **subjects** to that faculty (existing: `PUT /api/faculty/:id/subjects` with `subjectIds`).

### 3.5 HOD: Semester Timetable (6 Days, Mon–Sat)

- **HOD** is responsible for building the **semester timetable** for the week:
  - **6 days**: Monday to Saturday.
  - Uses **period slots** (e.g. P1 9:00–10:00, P2 10:00–11:00) defined per college.
  - Each slot can be assigned: subject, faculty, room (optional).
- This requires a **timetable** or **schedule** feature (e.g. `timetable_entries` table: day of week, period_slot_id, subject_id, faculty rbac_user_id, college_id, course_id, branch_id, semester).

---

## 4. Current Implementation vs Gaps

| Requirement | Current State | Gap |
|-------------|----------------|------|
| Hierarchy (Principal → HOD → Faculty) | ✅ RBAC: Principal/AO can create HOD and Faculty; HOD can create Faculty | Document and enforce “create HOD first” in UI/docs |
| Faculty Management shows faculty list | ✅ `GET /api/faculty` lists faculty; Admin page shows table | — |
| Show Principals in Faculty Management | ❌ Faculty Management only lists faculty | Add section or tab: list Principals, under each show HODs and faculty |
| Assign HOD per branch | ✅ Done in User Management (create user, role Branch HOD, set branch) | Optional: Faculty Management “Assign HOD” shortcut or view by branch |
| HOD uploads subjects per sem | ✅ Subjects CRUD exists (`/api/subjects`); scoped by college/course/branch | Optional: link subject to semester; HOD-only create permission |
| Create faculty user for subject | ✅ Create user (Faculty) in User Management; assign subjects in Faculty Management | — |
| HOD creates semester timetable | ❌ No timetable table or API | **To build**: timetable entity, API (create/update by HOD), UI (week view Mon–Sat) |

---

## 5. RBAC Reference (Backend)

From `backend/constants/rbac.js`:

- **ROLE_HIERARCHY**: Super Admin → Principal, AO, Attender, **BRANCH_HOD**, …, **FACULTY**; Principal/AO → … **BRANCH_HOD**, **FACULTY**; **BRANCH_HOD** → Attender, **FACULTY**.
- **BRANCH_HOD**: `requiresCollege`, `requiresCourse`, `requiresBranch`; can have multiple branches via `branch_ids`.
- **FACULTY**: `requiresCollege`, `requiresCourse`; can have `allBranches` or specific branches.

---

## 6. Suggested Implementation Order

1. **Document and enforce workflow**  
   - In User Management / Faculty Management, show short note: “Create HOD for branch first, then create Faculty and assign subjects.”

2. **Faculty Management UI enhancement**  
   - Add view: **By College / Principal** → list HODs per branch → list Faculty per HOD (or per branch).  
   - Optional: “Assign HOD” per branch (link to User Management with role and branch pre-filled).

3. **Subjects per semester**  
   - If needed: add `semester` (or `year_semester`) to `subjects` or a link table; filter subjects by semester in Faculty Management.

4. **Timetable feature**  
   - New table: e.g. `timetable_entries` (college_id, course_id, branch_id, semester, day_of_week 1–6, period_slot_id, subject_id, rbac_user_id for faculty).  
   - APIs: GET/POST/PUT by scope (HOD can manage for their branch).  
   - UI: HOD (or admin) sees week grid (Mon–Sat × periods), assign subject + faculty per cell.

---

*This document defines the intended Principal → HOD → Faculty workflow and Faculty Management behaviour. Use it to align backend scope and future UI changes.*
