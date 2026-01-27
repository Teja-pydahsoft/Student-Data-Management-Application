## Portal SSO Integration Template (for Other Applications)

This document is a **copy‑paste template** to integrate any new application (portal) with the existing **CRM SSO** system used by the admissions app.

Update only:
- **URLs** (CRM backend, portal base URL)
- **Database query and field names** in the backend example
- **Redirect routes** in the frontend example

---

## 1. High‑Level Flow (Same As Admissions App)

1. User clicks on a portal card in **CRM Frontend**.
2. CRM checks login; if needed, user logs into CRM.
3. CRM generates a short‑lived **encrypted SSO token** for that portal.
4. CRM redirects user to **Portal Login URL** with `?token=<encryptedToken>`:
   - Example: `https://your-portal.com/login?token=<encryptedToken>`
5. Portal:
   - Reads `token` from URL.
   - Calls **CRM Backend** `/auth/verify-token` to validate it.
   - On success, calls its own backend `/api/auth/sso-session` to create a **local session**.
   - Stores local token/user and redirects to portal dashboard.

---

## 2. Frontend Template (Next.js/React)

Use this as your **login page** in the new portal (adjust imports, routes, and UI as needed).

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

// 🔧 CHANGE THIS: CRM backend URL
const CRM_BACKEND_URL = process.env.NEXT_PUBLIC_CRM_BACKEND_URL || 'http://localhost:3000';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      handleSSOLogin(token);
    } else {
      // No SSO token → show normal login form
      setShowLoginForm(true);
    }
  }, [searchParams]);

  async function handleSSOLogin(encryptedToken: string) {
    setIsVerifying(true);
    setError(null);

    try {
      // 1) Verify token with CRM backend
      const verifyResponse = await fetch(`${CRM_BACKEND_URL}/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedToken }),
      });

      const verifyResult = await verifyResponse.json();

      if (!verifyResult.success || !verifyResult.valid) {
        throw new Error(verifyResult.message || 'Token validation failed');
      }

      const { userId, role, portalId, expiresAt } = verifyResult.data;

      // 2) Check expiry
      const expiryTime = new Date(expiresAt).getTime();
      if (Date.now() >= expiryTime) {
        throw new Error('Token has expired');
      }

      // 3) Create local session in this portal
      const sessionResponse = await fetch('/api/auth/sso-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role,
          portalId,
          ssoToken: encryptedToken,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create local session');
      }

      const sessionData = await sessionResponse.json();

      // 4) Store portal auth (🔧 adjust to your portal’s auth pattern)
      Cookies.set('token', sessionData.data.token, { expires: 7 });
      Cookies.set('user', JSON.stringify(sessionData.data.user), { expires: 7 });

      // 5) Redirect based on role (🔧 change routes as needed)
      const user = sessionData.data.user;
      if (user.roleName === 'Super Admin' || user.roleName === 'Sub Super Admin') {
        router.push('/superadmin/dashboard');
      } else if (user.isManager) {
        router.push('/manager/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    } catch (err: any) {
      console.error('SSO login error:', err);
      setError(err.message || 'SSO login failed');
      setShowLoginForm(true);

      // Clean URL (remove token)
      router.replace('/auth/login');
    } finally {
      setIsVerifying(false);
    }
  }

  // Loading UI during SSO verification
  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Error UI (optional)
  if (error && !showLoginForm) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          {/* 🔧 Optionally link back to CRM portals page */}
          <a
            href={process.env.NEXT_PUBLIC_CRM_FRONTEND_URL || 'http://localhost:5173'}
            className="text-blue-600 hover:underline"
          >
            Return to CRM Portal
          </a>
        </div>
      </div>
    );
  }

  // Your normal login form if no SSO token or SSO failed
  if (showLoginForm) {
    return (
      <div>
        {/* Existing login form goes here */}
      </div>
    );
  }

  return null;
}
```

---

## 3. Backend Template (Node.js / Express)

Add this to the **portal backend** (similar to `createSSOSession` in admissions `auth.controller.js`), and wire it to a route `POST /api/auth/sso-session`.

```javascript
// src/controllers/auth.controller.js (PORTAL VERSION TEMPLATE)

import axios from 'axios';
import { getPool } from '../config-sql/database.js'; // 🔧 CHANGE to your DB helper
import { generateToken } from '../utils/generateToken.js'; // same pattern as admissions
import { successResponse, errorResponse } from '../utils/response.util.js'; // or your own helpers

// @desc    Create SSO session from CRM token (for this portal)
// @route   POST /api/auth/sso-session
// @access  Public (token-guarded via CRM verification)
export const createSSOSession = async (req, res) => {
  try {
    const { userId, role, portalId, ssoToken } = req.body;

    console.log('Portal SSO session request:', { userId, role, portalId });

    if (!userId || !ssoToken) {
      return errorResponse(res, 'User ID and SSO token are required', 400);
    }

    // 1) (Optional but recommended) Verify token again with CRM backend
    const CRM_BACKEND_URL = process.env.CRM_BACKEND_URL || 'http://localhost:3000';

    try {
      const verifyResponse = await axios.post(`${CRM_BACKEND_URL}/auth/verify-token`, {
        encryptedToken: ssoToken,
      });

      const verifyResult = verifyResponse.data;

      if (!verifyResult.success || !verifyResult.valid) {
        console.log('SSO token verification failed:', verifyResult.message);
        return errorResponse(res, 'Invalid SSO token', 401);
      }

      if (verifyResult.data.userId !== userId) {
        console.log('User ID mismatch in SSO token');
        return errorResponse(res, 'Token user ID mismatch', 401);
      }
    } catch (verifyError) {
      console.error('Error verifying SSO token with CRM backend:', verifyError.message);
      if (process.env.NODE_ENV === 'production') {
        return errorResponse(res, 'SSO token verification failed', 500);
      }
      // In dev, continue even if CRM is down
    }

    // 2) Look up user in THIS portal’s database
    let pool;
    try {
      pool = getPool();
    } catch (error) {
      console.error('Database connection error:', error);
      return errorResponse(res, 'Database connection failed', 500);
    }

    // 🔧 CHANGE THIS QUERY to match your portal’s user table/fields
    const [users] = await pool.execute(
      `SELECT 
        id,
        name,
        email,
        role_name,
        managed_by,
        is_manager,
        designation,
        permissions,
        is_active,
        created_at,
        updated_at
       FROM users
       WHERE id = ? AND is_active = 1`,
      [userId]
    );

    if (!users || users.length === 0) {
      console.log('User not found in portal database:', userId);
      return errorResponse(res, 'User not found in portal database', 404);
    }

    const userData = users[0];

    // 3) Map DB row → user object expected by frontend
    let permissions = {};
    try {
      if (userData.permissions) {
        if (typeof userData.permissions === 'string') {
          permissions = JSON.parse(userData.permissions);
        } else if (typeof userData.permissions === 'object') {
          permissions = userData.permissions;
        }
      }
    } catch (parseError) {
      console.error('Error parsing permissions JSON:', parseError);
      permissions = {};
    }

    const user = {
      id: userData.id,
      _id: userData.id,
      name: userData.name,
      email: userData.email,
      // 🔧 Map/rename as needed for this portal
      roleName: userData.role_name || role,
      managedBy: userData.managed_by,
      isManager: userData.is_manager === 1 || userData.is_manager === true,
      designation: userData.designation,
      permissions,
      isActive: userData.is_active === 1 || userData.is_active === true,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
      portalId, // optional, if you want to keep it
    };

    // 4) Generate local JWT/session token for this portal
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return errorResponse(res, 'Server configuration error', 500);
    }

    const token = generateToken(user.id);

    console.log('Portal SSO session created for:', user.email);

    return successResponse(
      res,
      { token, user },
      'SSO session created successfully',
      200
    );
  } catch (error) {
    console.error('Portal SSO session error:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, error.message || 'Failed to create SSO session', 500);
  }
};
```

### Route Wiring Example

```javascript
// src/routes/auth.routes.js (PORTAL VERSION TEMPLATE)

import express from 'express';
import { createSSOSession } from '../controllers/auth.controller.js';

const router = express.Router();

// ... other auth routes (login, logout, etc.)

router.post('/sso-session', createSSOSession);

export default router;
```

In your main `server.js` (for that portal):

```javascript
import authRoutes from './routes/auth.routes.js';

app.use('/api/auth', authRoutes);
```

---

## 4. Environment Variables Needed in New Portal

Set these in the **portal** environment (.env):

```env
CRM_BACKEND_URL=http://localhost:3000          # or production URL
JWT_SECRET=your-portal-jwt-secret              # used by generateToken
DB_HOST=...
DB_NAME=...
DB_USER=...
DB_PASSWORD=...
```

On the **portal frontend** (Next.js):

```env
NEXT_PUBLIC_CRM_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_CRM_FRONTEND_URL=http://localhost:5173
```

---

## 5. Checklist for Integrating a New Application

- **Frontend**
  - Detect `token` query parameter on login page.
  - Call CRM `/auth/verify-token` with `encryptedToken`.
  - On success, call portal `/api/auth/sso-session` with `{ userId, role, portalId, ssoToken }`.
  - Store returned `{ token, user }` in cookies/local storage.
  - Redirect user to the correct dashboard based on `roleName` / `isManager`.

- **Backend**
  - Implement `createSSOSession` exactly once per portal, adjust DB query/field names.
  - Expose `POST /api/auth/sso-session` route.
  - Use same JWT pattern as admissions (`generateToken(id)`).
  - Return `{ token, user }` in a consistent shape for the frontend.

Following this template, you can **copy‑paste** the controller and login logic into any new portal and only change:
- DB query and fields,
- URL environment variables,
- final redirect routes.

