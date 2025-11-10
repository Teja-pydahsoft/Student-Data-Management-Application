## Student Registration Workflow

### High-Level Flow
1. **Form Creation (Admin)**  
   - Admins configure dynamic registration forms in Supabase via `POST /api/forms` handled by `backend/controllers/formController.js#createForm`.  
   - Each form stores `form_fields` (field metadata) in Supabase and exposes a public URL/QR code for students.

2. **Student Submission (Public)**  
   - Students submit data against a form via the public route `POST /api/forms/:formId/submit` handled by `submissionController.submitForm`.  
   - Payload (including uploaded files encoded as base64) is stored as a pending record in Supabase table `form_submissions` with `status = 'pending'`.  
   - Optional admission number auto-generation reads/updates Supabase `settings`.

3. **Review & Approval (Admin Portal)**  
   - Admins fetch pending submissions from Supabase through `GET /api/submissions`.  
   - On approval (`POST /api/submissions/:submissionId/approve`), the backend promotes data into the MySQL **master** database using `submissionController.approveSubmission`.

4. **Post-Approval Master DB Writes**
   - A per-form archival table named `form_<formId>` is ensured/altered to match the form schema, and the full submission payload is inserted there.
   - The primary `students` table receives either an **update** (if the admission number already exists) or a **new row**.  
   - Individual columns (e.g., `student_name`, `course`, `branch`, `current_year`, `current_semester`, contact details) are populated alongside the JSON blob `student_data`.  
   - Approval also updates the Supabase submission row (`status = 'approved'`, reviewer metadata) and records an audit trail in MySQL `audit_logs`.

### Field Mapping into `students` (Master DB)
During approval we normalize common field labels to their respective columns. After the latest update, the aliases below are recognized and stored in first-class columns:

- `pin_no`, `Pin No`
- `batch`, `Batch`
- `course`, `Course`
- `branch`, `Branch`
- `stud_type`, `StudType`
- `student_name`, `Student Name`
- `student_status`, `Student Status`
- `scholar_status`, `Scholar Status`
- `student_mobile`, `Student Mobile Number`
- `parent_mobile1`, `Parent Mobile Number 1`
- `parent_mobile2`, `Parent Mobile Number 2`
- `caste`, `Caste`
- `gender`, `M/F`
- `father_name`, `Father Name`
- `dob`, `DOB (Date of Birth - DD-MM-YYYY)`, `DOB (Date-Month-Year)`
- `adhar_no`, `AADHAR No`
- `admission_date`, `Admission Date`, `Admission Year (Ex: 09-Sep-2003)`
- `student_address`, `Student Address`, `Student Address (D.No, Str name, Village, Mandal, Dist)`
- `city_village`, `City/Village`, `CityVillage Name`
- `mandal_name`, `Mandal Name`
- `district`, `District`, `District Name`
- `previous_college`, `Previous College Name`
- `certificates_status`, `Certificate Status`
- `student_photo`
- `remarks`, `Remarks`
- `current_year`, `currentYear`, `Current Year`, `Current Academic Year`
- `current_semester`, `currentSemester`, `Current Semester`

A normalized JSON snapshot of the submission remains in `students.student_data` for reference/auditing.

### Students After Approval
- Each approved student row in `students` contains:
  - Identifiers: `admission_number`, `admission_no`, optional `pin_no`.
  - Academic context: `course`, `branch`, `batch`, `current_year`, `current_semester`, `stud_type`.
  - Personal/contact info: `student_name`, `dob`, `gender`, `student_mobile`, `parent_mobile1/2`, `student_address`, `city_village`, `mandal_name`, `district`, `caste`, `scholar_status`.
  - Administrative details: `student_status`, `previous_college`, `certificates_status`, `remarks`, `student_photo`, plus the serialized `student_data` JSON.
- Audit logs capture who approved the submission and when. The original Supabase submission retains `status = 'approved'` with reviewer and admission number metadata.

### Key Observations
- Approval previously ignored `course`, `Current Academic Year`, and several label variations, leaving those columns empty; alias normalization now persists them correctly.
- The flow depends on consistent admission numbers. Duplicates are handled gracefully: existing rows merge data, new rows are created otherwise.
- Dynamic per-form tables ensure that the exact submission structure is stored for downstream analytics/reporting.

### Recommended Follow-Ups
- Maintain Supabase form field labels aligned with the alias list for seamless column persistence.
- Consider surfacing validation to guarantee `course`, `current_year`, and `current_semester` are provided before approval (stage-dependent logic relies on them).
- Periodically review `students.student_data` for large payloads (50 KB safeguard exists) and adjust if richer assets are expected.

