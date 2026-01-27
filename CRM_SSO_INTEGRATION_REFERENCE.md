# CRM → Portal SSO Integration Reference

Use this when connecting your **CRM app** to the **Student Data Management Portal** (this app). It covers redirect URLs, token format, and RBAC vs **student** SSO.

---

## 1. Where to Redirect (Portal Login URL)

Redirect users to the **Portal login page** with the SSO token as a query parameter. Use the path that matches the user type:

| User type | Redirect URL |
|-----------|--------------|
| **RBAC** (staff/admin) | `{PORTAL_FRONTEND_BASE}/login?token={encryptedToken}` |
| **Student** | `{PORTAL_FRONTEND_BASE}/student/login?token={encryptedToken}` |

**Examples:**

| Environment | Portal base | RBAC redirect | Student redirect |
|-------------|-------------|---------------|------------------|
| Local dev | `http://localhost:5173` | `http://localhost:5173/login?token=...` | `http://localhost:5173/student/login?token=...` |
| Production | `https://your-portal.com` | `https://your-portal.com/login?token=...` | `https://your-portal.com/student/login?token=...` |

Both URLs accept `?token=...`; the path is a hint for where the user lands after SSO (admin dashboard vs student dashboard). The form login (username/password) remains available as fallback when there is no token.

---

## 1.5 Unified login & SSO (Portal side — cross-check)

The Portal uses **unified login** for form-based auth. SSO is an additional path when the user arrives with `?token=...`.

| Scenario | What happens |
|----------|--------------|
| **No `?token=`** | User sees login form → submits username/password → **`POST /api/auth/unified-login`** → backend checks **Admin → RBAC → Staff → Student** (in that order) → returns `{ token, user }`. |
| **`?token=` present** | Portal skips form → **SSO flow**: CRM `POST /auth/verify-token` → **`POST /api/auth/sso-session`** → returns `{ token, user }` in the **same shape** as unified login for RBAC/Student. |

- **Unified login** = single form at `/login` and `/student/login`; one endpoint `unified-login`; backend decides user type from credentials.
- **SSO** = no form; token in URL; verify-token + sso-session; same JWT and `user` format as unified login for RBAC and Student.
- **`GET /api/auth/verify`** works for sessions created via **either** unified login or SSO (same JWT structure).

So unified login is **unchanged** and still used for all form logins. SSO only runs when there is a token in the URL.

---

## 2. CRM Backend: Implement `POST /auth/verify-token`

The **Portal frontend** calls your CRM backend to validate the token. Your CRM must expose this endpoint.

### Request (from Portal)

```http
POST {CRM_BACKEND_URL}/auth/verify-token
Content-Type: application/json

{
  "encryptedToken": "<the token you put in the redirect URL>"
}
```

### Response (success)

```json
{
  "success": true,
  "valid": true,
  "data": {
    "userId": 1,
    "role": "super_admin",
    "portalId": "student-portal",
    "expiresAt": "2025-01-27T12:00:00.000Z"
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `success` | ✅ | Must be `true`. |
| `valid` | ✅ | Must be `true`. |
| `data` | ✅ | Object with user/session info. |
| `data.userId` | ✅ | **RBAC:** Portal `rbac_users.id`. **Student:** Portal `students.id`. See §4 & §5. |
| `data.role` | ✅ | Either `student` or an RBAC role (see §6). |
| `data.portalId` | ⬜ | Optional. |
| `data.expiresAt` | ⬜ | ISO 8601; token rejected if past. |

### Response (failure)

```json
{
  "success": false,
  "valid": false,
  "message": "Token expired"
}
```

---

## 3. RBAC vs Students (SSO for Both)

| User type | SSO? | Redirect | `data.role` | `data.userId` |
|-----------|------|----------|-------------|----------------|
| **RBAC** | ✅ | `/login?token=...` | RBAC role (§6) | `rbac_users.id` |
| **Student** | ✅ | `/student/login?token=...` | `student` | `students.id` |

Students can use **either** SSO (`/student/login?token=...`) **or** the username/password form at `/student/login`. RBAC users use SSO or the form at `/login`.

---

## 4. RBAC Users: `userId` Format

The Portal looks up RBAC users by **`rbac_users.id`**:

```sql
SELECT ... FROM rbac_users WHERE id = ? AND is_active = 1
```

- **`data.userId`** must be the Portal’s **`rbac_users.id`**.
- If CRM uses a different user table, use the same DB or a mapping so that `userId` in the token is the **Portal `rbac_users.id`**.

---

## 5. Students: `userId` Format

The Portal looks up students by **`students.id`**:

```sql
-- student_credentials.student_id = students.id
SELECT ... FROM student_credentials WHERE student_id = ? ...
SELECT ... FROM students WHERE id = ? ...
```

- **`data.userId`** must be the Portal’s **`students.id`** (same as `student_credentials.student_id`).
- If CRM uses a different identifier, map it to **Portal `students.id`** and put that in `userId`.

---

## 6. Roles

### RBAC roles (`data.role` for staff/admin)

| Role | Value |
|------|--------|
| Super Admin | `super_admin` |
| College Principal | `college_principal` |
| College AO | `college_ao` |
| College Attender | `college_attender` |
| Branch HOD | `branch_hod` |
| Office Assistant | `office_assistant` |
| Cashier | `cashier` |

### Student

| Role | Value |
|------|--------|
| Student | `student` |

For SSO, use **exactly** `student` when the user is a student. Legacy `admin` / `staff` are not supported via SSO; use RBAC roles above.

---

## 7. Students: Form Login (Fallback, No SSO)

Students can still log in **without** SSO at **`/student/login`**:

- **Username**: `student_credentials.username` or **admission_number**
- **Password**: bcrypt hash in `student_credentials.password_hash`

No token, no verify-token. Use this when not using SSO.

---

## 8. Flow Summary

### RBAC SSO

1. User logs into **CRM**.
2. CRM generates encrypted SSO token with `userId` = `rbac_users.id`, `role` = RBAC role.
3. CRM redirects to `{PORTAL}/login?token={encryptedToken}`.
4. Portal calls CRM `POST /auth/verify-token` → then `POST /api/auth/sso-session`.
5. Portal creates session and redirects to admin dashboard (or first allowed module).

### Student SSO

1. Student logs into **CRM**.
2. CRM generates encrypted SSO token with `userId` = `students.id`, `role` = `student`.
3. CRM redirects to `{PORTAL}/student/login?token={encryptedToken}`.
4. Portal calls CRM `POST /auth/verify-token` → then `POST /api/auth/sso-session`.
5. Portal creates session and redirects to **student dashboard** (`/student/dashboard`).

---

## 9. CORS

The Portal frontend calls the **CRM backend** verify-token from the browser. Your CRM API must allow the **Portal frontend origin** (e.g. `http://localhost:5173` or production Portal URL) in CORS.

---

## 10. Quick Copy-Paste (CRM Side)

### Redirect URLs

**RBAC (staff/admin):**
```text
{PORTAL_FRONTEND_BASE}/login?token={encryptedToken}
```

**Student:**
```text
{PORTAL_FRONTEND_BASE}/student/login?token={encryptedToken}
```

### Verify-token response (RBAC example)

```json
{
  "success": true,
  "valid": true,
  "data": {
    "userId": 1,
    "role": "super_admin",
    "portalId": "student-portal",
    "expiresAt": "2025-01-27T12:00:00.000Z"
  }
}
```

### Verify-token response (Student example)

```json
{
  "success": true,
  "valid": true,
  "data": {
    "userId": 42,
    "role": "student",
    "portalId": "student-portal",
    "expiresAt": "2025-01-27T12:00:00.000Z"
  }
}
```

- **RBAC:** `userId` = `rbac_users.id`, `role` = one of the RBAC values above.
- **Student:** `userId` = `students.id`, `role` = `student`.
