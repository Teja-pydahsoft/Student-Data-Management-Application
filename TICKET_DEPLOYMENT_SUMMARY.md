# 📊 Ticket App Deployment Summary

## ✅ **What We've Done**

### **1. Code Updates**
- ✅ Updated `ticket-backend/server.js` to read CORS from environment variable
- ✅ Updated `frontend/src/components/Layout/StudentLayout.jsx` to use `VITE_TICKET_APP_URL`
- ✅ Updated `frontend/src/components/Layout/AdminLayout.jsx` to use `VITE_TICKET_APP_URL`

### **2. Documentation Created**
- ✅ `TICKET_APP_DEPLOYMENT_GUIDE.md` - Complete step-by-step deployment guide
- ✅ `TICKET_ENV_QUICK_REFERENCE.md` - Quick reference for environment variables

---

## 🚀 **Next Steps for Deployment**

### **Step 1: Deploy Ticket Backend to Render** ⏱️ 10 minutes

1. Go to [Render.com](https://render.com)
2. Create new Web Service
3. Connect GitHub repo: `teampydahsoft/Student-Data-Management-Application`
4. Configure:
   - Root Directory: `ticket-backend`
   - Build: `npm install`
   - Start: `npm start`
5. Add environment variables (see `TICKET_ENV_QUICK_REFERENCE.md`)
6. Deploy and note the URL

### **Step 2: Deploy Ticket Frontend to Vercel** ⏱️ 5 minutes

1. Go to [Vercel.com](https://vercel.com)
2. Create new Project
3. Import GitHub repo
4. Configure:
   - Root Directory: `ticket-app`
   - Build: `npm run build`
   - Output: `dist`
5. Add environment variables:
   - `VITE_API_URL` = Render backend URL from Step 1
   - `VITE_MAIN_APP_URL` = `https://pydahsdms.vercel.app`
6. Deploy and note the URL

### **Step 3: Update CORS** ⏱️ 2 minutes

1. Go back to Render (ticket backend)
2. Update `CORS_ORIGINS` with Vercel URL from Step 2
3. Save (auto-redeploys)

### **Step 4: Update Main Frontend** ⏱️ 3 minutes

1. Go to Vercel → `pydahsdms` project
2. Settings → Environment Variables
3. Add: `VITE_TICKET_APP_URL` = Vercel URL from Step 2
4. Redeploy

### **Step 5: Test** ⏱️ 5 minutes

1. Login to main app
2. Click "Ticket Management"
3. Should redirect to ticket app with SSO
4. Create a test ticket
5. Verify it appears in admin panel

---

## 🔐 **Critical Configuration**

### **JWT Secret Synchronization**

**MOST IMPORTANT**: The `JWT_SECRET` in your ticket backend MUST match your main backend!

```bash
# You need to get this value from your main backend
# Location: sdbms-backend.pydahsoft.in
# Variable: JWT_SECRET

# Then use the EXACT SAME value in ticket backend on Render
```

Without matching JWT secrets, SSO will NOT work!

---

## 📁 **Project Structure**

```
Student-Data-Management-Application/
├── backend/                    # Main Backend (already deployed)
│   └── .env                   # Contains JWT_SECRET
├── frontend/                   # Main Frontend (already deployed)
│   └── .env                   # Now needs VITE_TICKET_APP_URL
├── ticket-backend/            # NEW - Deploy to Render
│   ├── server.js             # ✅ Updated for env CORS
│   └── .env                  # Create on Render with JWT_SECRET
└── ticket-app/                # NEW - Deploy to Vercel
    └── .env                   # Create on Vercel with API URLs
```

---

## 🎯 **Expected Results**

After successful deployment:

1. **Main App** (`https://pydahsdms.vercel.app`)
   - Sidebar has "Ticket Management" link
   - Clicking it redirects to ticket app with SSO

2. **Ticket App** (`https://pydahsdms-tickets.vercel.app`)
   - Students can create tickets
   - Students can view their tickets
   - Admins can manage all tickets
   - File uploads work

3. **Database**
   - All tickets stored in same MySQL database
   - Tables: `tickets`, `complaint_categories`, `ticket_assignments`, etc.

---

## 📊 **Architecture Diagram**

```
┌──────────────────────────────────────────────────────────────┐
│                         USERS                                 │
│  Students & Admins accessing via web browser                 │
└────────────────┬─────────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Main App    │  │  Ticket App  │
│  (Vercel)    │  │  (Vercel)    │
│  Port: 443   │  │  Port: 443   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       │ API Calls       │ API Calls
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Main Backend │  │Ticket Backend│
│ (pydahsoft)  │  │  (Render)    │
│ Port: 443    │  │  Port: 443   │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
                ▼
        ┌──────────────┐
        │  AWS RDS     │
        │  MySQL DB    │
        │ Port: 3306   │
        └──────────────┘
```

---

## ✅ **Deployment Checklist**

Before you start:
- [ ] Have access to Render.com account
- [ ] Have access to Vercel.com account
- [ ] Have access to GitHub repository
- [ ] Know the JWT_SECRET from main backend
- [ ] Have AWS RDS credentials

During deployment:
- [ ] Deploy ticket backend to Render
- [ ] Deploy ticket frontend to Vercel
- [ ] Update CORS on ticket backend
- [ ] Update main frontend environment variables
- [ ] Test SSO login flow
- [ ] Test ticket creation
- [ ] Test file uploads

After deployment:
- [ ] Document the new URLs
- [ ] Update team documentation
- [ ] Monitor Render logs for errors
- [ ] Set up uptime monitoring (optional)

---

## 🆘 **Need Help?**

1. **Check the guides**:
   - `TICKET_APP_DEPLOYMENT_GUIDE.md` - Detailed instructions
   - `TICKET_ENV_QUICK_REFERENCE.md` - Environment variables

2. **Common issues**:
   - JWT_SECRET mismatch → SSO won't work
   - CORS not configured → API calls fail
   - Wrong API URL → 404 errors

3. **Logs**:
   - Render: Service → Logs tab
   - Vercel: Deployment → Function Logs
   - Browser: F12 → Console tab

---

## 💡 **Pro Tips**

1. **Render Free Tier**: Sleeps after 15 min inactivity
   - First request after sleep takes ~30 seconds
   - Upgrade to Starter ($7/mo) for always-on

2. **Environment Variables**: Changes require redeployment
   - Render: Auto-redeploys on save
   - Vercel: Manual redeploy needed

3. **Custom Domains**: Optional but professional
   - Ticket app: `tickets.pydahsoft.in`
   - Ticket API: `ticket-api.pydahsoft.in`

4. **Database**: Both backends share same DB
   - No migration needed
   - Tables already exist from main backend

---

## 📞 **Support Resources**

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

---

**Total Deployment Time**: ~25 minutes
**Cost**: $0/month (free tiers)
**Difficulty**: Medium

---

**Ready to deploy? Start with Step 1! 🚀**
