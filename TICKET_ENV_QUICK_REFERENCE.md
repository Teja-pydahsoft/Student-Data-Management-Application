# 🔐 Environment Variables Quick Reference

## 📋 **Copy-Paste Ready Configurations**

### **1. Ticket Backend (Render.com)**

```env
PORT=5001
NODE_ENV=production
DB_HOST=student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=Student!0000
DB_NAME=student_database
DB_PORT=3306
DB_DIALECT=mysql
JWT_SECRET=<GET_FROM_MAIN_BACKEND>
CORS_ORIGINS=https://pydahsdms.vercel.app,https://pydahsdms-tickets.vercel.app
```

**⚠️ IMPORTANT**: Replace `<GET_FROM_MAIN_BACKEND>` with the actual JWT_SECRET from your main backend!

---

### **2. Ticket App Frontend (Vercel)**

```env
VITE_API_URL=https://pydahsdms-ticket-backend.onrender.com/api
VITE_MAIN_APP_URL=https://pydahsdms.vercel.app
```

**Note**: Update the Render URL after deployment if different.

---

### **3. Main Frontend Update (Vercel)**

Add this new variable to your existing main frontend (`pydahsdms`):

```env
VITE_TICKET_APP_URL=https://pydahsdms-tickets.vercel.app
```

**Note**: Update after deploying ticket app if URL is different.

---

## 🔄 **Deployment Order**

1. ✅ Deploy **Ticket Backend** to Render first
2. ✅ Note the Render URL (e.g., `https://pydahsdms-ticket-backend.onrender.com`)
3. ✅ Deploy **Ticket Frontend** to Vercel using the Render URL
4. ✅ Note the Vercel URL (e.g., `https://pydahsdms-tickets.vercel.app`)
5. ✅ Update **Ticket Backend** CORS with the Vercel URL
6. ✅ Update **Main Frontend** with ticket app URL

---

## 🎯 **Final URLs**

After deployment, your architecture will be:

```
┌─────────────────────────────────────────────────────────┐
│                     USER ACCESS                          │
├─────────────────────────────────────────────────────────┤
│  Main App:    https://pydahsdms.vercel.app/             │
│  Ticket App:  https://pydahsdms-tickets.vercel.app/     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                     BACKEND APIs                         │
├─────────────────────────────────────────────────────────┤
│  Main API:    https://sdbms-backend.pydahsoft.in/api    │
│  Ticket API:  https://pydahsdms-ticket-backend          │
│               .onrender.com/api                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                     DATABASE                             │
├─────────────────────────────────────────────────────────┤
│  AWS RDS MySQL: student_database                        │
│  Host: student-database.cfu0qmo26gh3.ap-south-1         │
│        .rds.amazonaws.com                                │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ **Verification Checklist**

After deployment, verify:

- [ ] Ticket backend health: `https://pydahsdms-ticket-backend.onrender.com/health`
- [ ] Ticket app loads: `https://pydahsdms-tickets.vercel.app`
- [ ] SSO works: Login to main app → Click "Ticket Management"
- [ ] Ticket creation works
- [ ] File uploads work
- [ ] Admin can view all tickets
- [ ] Students can view only their tickets

---

## 🚨 **Common Issues**

### **Issue: "JWT_SECRET not matching"**
```bash
# Get JWT_SECRET from main backend
# Method 1: Check your hosting provider's environment variables
# Method 2: Contact your backend administrator
# Method 3: Check your local .env file (if you have access)
```

### **Issue: "CORS Error"**
```bash
# Ensure CORS_ORIGINS includes both:
# 1. Main app URL: https://pydahsdms.vercel.app
# 2. Ticket app URL: https://pydahsdms-tickets.vercel.app
```

### **Issue: "Database Connection Failed"**
```bash
# Verify AWS RDS security group allows Render IPs
# Render uses dynamic IPs, so you may need to:
# 1. Whitelist Render's IP ranges
# 2. Or use 0.0.0.0/0 (less secure but works)
```

---

## 📝 **Notes**

1. **JWT_SECRET**: Must be identical in both backends for SSO to work
2. **Database**: Both backends share the same MySQL database
3. **CORS**: Must allow both frontend URLs in both backends
4. **Render Free Tier**: Sleeps after 15 min inactivity (upgrade to $7/mo for always-on)
5. **Vercel**: Unlimited deployments on free tier

---

## 🔗 **Quick Links**

- [Render Dashboard](https://dashboard.render.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Main App](https://pydahsdms.vercel.app)
- [Main Backend API](https://sdbms-backend.pydahsoft.in/api)

---

**Last Updated**: January 2026
