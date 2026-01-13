# 🚀 Ticket App Deployment Guide - Vercel + Render

## 📍 **Your Production Setup**

### **Existing Infrastructure**
- **Main Frontend**: `https://pydahsdms.vercel.app/`
- **Main Backend**: `https://sdbms-backend.pydahsoft.in/api`
- **Database**: AWS RDS MySQL (`student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com`)

### **New Services to Deploy**
- **Ticket App Frontend**: To be deployed on Vercel
- **Ticket Backend**: To be deployed on Render

---

## 🎯 **Recommended URLs**

```
Main App:           https://pydahsdms.vercel.app/
Main Backend:       https://sdbms-backend.pydahsoft.in/api
Ticket App:         https://pydahsdms-tickets.vercel.app/  (or tickets.pydahsoft.in)
Ticket Backend:     https://pydahsdms-ticket-api.onrender.com/api
```

---

## 📝 **STEP-BY-STEP DEPLOYMENT**

### **STEP 1: Deploy Ticket Backend to Render**

#### **1.1 Create Web Service**

1. Go to [Render.com](https://render.com) and login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `teampydahsoft/Student-Data-Management-Application`

#### **1.2 Service Configuration**

```yaml
Name: pydahsdms-ticket-backend
Region: Singapore (ap-southeast-1) - closest to AWS RDS ap-south-1
Branch: main
Root Directory: ticket-backend
Runtime: Node
Build Command: npm install
Start Command: npm start
Instance Type: Free (or Starter $7/month for better performance)
Auto-Deploy: Yes
```

#### **1.3 Environment Variables**

Click **"Advanced"** → **"Add Environment Variable"** and add these:

```env
# Server Configuration
PORT=5001
NODE_ENV=production

# Database Configuration (SAME as main backend)
DB_HOST=student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=Student!0000
DB_NAME=student_database
DB_PORT=3306
DB_DIALECT=mysql

# JWT Secret (MUST MATCH MAIN BACKEND!)
# Get this from your main backend's JWT_SECRET
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# CORS Origins (Update after deploying frontend)
CORS_ORIGINS=https://pydahsdms.vercel.app,https://pydahsdms-tickets.vercel.app
```

**⚠️ CRITICAL**: The `JWT_SECRET` MUST be identical to your main backend's JWT_SECRET for SSO to work!

#### **1.4 Deploy**

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for deployment
3. **Note your URL**: `https://pydahsdms-ticket-backend.onrender.com`

---

### **STEP 2: Deploy Ticket App Frontend to Vercel**

#### **2.1 Create New Project**

1. Go to [Vercel.com](https://vercel.com) and login
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository

#### **2.2 Project Configuration**

```yaml
Project Name: pydahsdms-tickets
Framework Preset: Vite
Root Directory: ticket-app
Build Command: npm run build
Output Directory: dist
Install Command: npm install
Node Version: 18.x
```

#### **2.3 Environment Variables**

Click **"Environment Variables"** and add:

```env
# Ticket Backend API URL
VITE_API_URL=https://pydahsdms-ticket-backend.onrender.com/api

# Main App URL (for SSO redirects)
VITE_MAIN_APP_URL=https://pydahsdms.vercel.app
```

#### **2.4 Deploy**

1. Click **"Deploy"**
2. Wait 2-3 minutes
3. **Note your URL**: `https://pydahsdms-tickets.vercel.app`

---

### **STEP 3: Update Main Frontend Configuration**

#### **3.1 Add Environment Variable to Main Frontend**

Go to your main frontend project on Vercel (`pydahsdms`):

1. Go to **Settings** → **Environment Variables**
2. Add new variable:

```env
VITE_TICKET_APP_URL=https://pydahsdms-tickets.vercel.app
```

3. Click **"Save"**
4. Go to **Deployments** tab
5. Click **"Redeploy"** on the latest deployment

---

### **STEP 4: Update Ticket Backend CORS**

After deploying the ticket frontend, update the ticket backend on Render:

1. Go to your **pydahsdms-ticket-backend** service on Render
2. Click **"Environment"** tab
3. Update `CORS_ORIGINS`:

```env
CORS_ORIGINS=https://pydahsdms.vercel.app,https://pydahsdms-tickets.vercel.app
```

4. Click **"Save Changes"** (will auto-redeploy)

---

### **STEP 5: Update Main Backend CORS (if needed)**

If your main backend needs to allow the ticket app:

1. Go to wherever your main backend is hosted (`sdbms-backend.pydahsoft.in`)
2. Add ticket app URL to allowed origins:

```env
FRONTEND_URLS=https://pydahsdms.vercel.app,https://pydahsdms-tickets.vercel.app
```

---

## 🔐 **CRITICAL: JWT Secret Synchronization**

**The most important step for SSO to work:**

1. Get the `JWT_SECRET` from your main backend
2. Use the **EXACT SAME** value in your ticket backend
3. This allows both backends to verify the same authentication tokens

To verify:
```bash
# Check main backend JWT_SECRET
echo $JWT_SECRET

# Ensure ticket backend has the same value
```

---

## ✅ **Deployment Checklist**

- [ ] Ticket backend deployed to Render
- [ ] Ticket frontend deployed to Vercel
- [ ] `JWT_SECRET` is identical in both backends
- [ ] CORS configured to allow both frontend URLs
- [ ] Main frontend has `VITE_TICKET_APP_URL` environment variable
- [ ] Ticket app has `VITE_API_URL` and `VITE_MAIN_APP_URL`
- [ ] Both backends connect to same MySQL database
- [ ] Test SSO login flow (main app → ticket app)
- [ ] Test ticket creation
- [ ] Verify file uploads work

---

## 🧪 **Testing the Deployment**

### **Test 1: Direct Access**
1. Visit `https://pydahsdms-tickets.vercel.app`
2. Should redirect to main app login

### **Test 2: SSO Flow**
1. Login to main app: `https://pydahsdms.vercel.app`
2. Click "Ticket Management" in sidebar
3. Should seamlessly redirect to ticket app with authentication

### **Test 3: Ticket Creation**
1. As student: Create a new ticket
2. As admin: View and manage tickets
3. Verify file uploads work

### **Test 4: API Health**
```bash
# Test ticket backend
curl https://pydahsdms-ticket-backend.onrender.com/health

# Should return:
# {"status":"ok","service":"ticket-backend"}
```

---

## 🔄 **Updating Environment Variables**

### **On Vercel (Frontend)**
1. Go to Project → **Settings** → **Environment Variables**
2. Edit the variable
3. Click **"Save"**
4. Go to **Deployments** → **Redeploy** latest deployment

### **On Render (Backend)**
1. Go to Service → **Environment** tab
2. Edit the variable
3. Click **"Save Changes"**
4. Service auto-redeploys

---

## 🎨 **Optional: Custom Domain Setup**

### **For Ticket App (Vercel)**

If you want `tickets.pydahsoft.in` instead of `pydahsdms-tickets.vercel.app`:

1. Go to Vercel project → **Settings** → **Domains**
2. Add domain: `tickets.pydahsoft.in`
3. Add DNS records in your domain provider:
   ```
   Type: CNAME
   Name: tickets
   Value: cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-30 minutes)
5. Update all environment variables with new URL

### **For Ticket Backend (Render)**

If you want `ticket-api.pydahsoft.in`:

1. Go to Render service → **Settings** → **Custom Domain**
2. Add domain: `ticket-api.pydahsoft.in`
3. Add DNS records:
   ```
   Type: CNAME
   Name: ticket-api
   Value: <provided by Render>
   ```
4. Update all environment variables with new URL

---

## 📊 **Complete Environment Variables Reference**

### **Main Backend** (`sdbms-backend.pydahsoft.in`)
```env
PORT=5000
NODE_ENV=production
DB_HOST=student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=Student!0000
DB_NAME=student_database
JWT_SECRET=<your_secret>
FRONTEND_URLS=https://pydahsdms.vercel.app,https://pydahsdms-tickets.vercel.app
```

### **Ticket Backend** (Render)
```env
PORT=5001
NODE_ENV=production
DB_HOST=student-database.cfu0qmo26gh3.ap-south-1.rds.amazonaws.com
DB_USER=admin
DB_PASSWORD=Student!0000
DB_NAME=student_database
JWT_SECRET=<SAME_AS_MAIN_BACKEND>
CORS_ORIGINS=https://pydahsdms.vercel.app,https://pydahsdms-tickets.vercel.app
```

### **Main Frontend** (Vercel)
```env
VITE_API_URL=https://sdbms-backend.pydahsoft.in/api
VITE_TICKET_APP_URL=https://pydahsdms-tickets.vercel.app
```

### **Ticket App** (Vercel)
```env
VITE_API_URL=https://pydahsdms-ticket-backend.onrender.com/api
VITE_MAIN_APP_URL=https://pydahsdms.vercel.app
```

---

## 🚨 **Troubleshooting**

### **Issue: SSO Not Working**
**Solution**: Verify `JWT_SECRET` is identical in both backends

### **Issue: CORS Errors**
**Solution**: Check `CORS_ORIGINS` includes both frontend URLs

### **Issue: 401 Unauthorized**
**Solution**: Clear browser cache and localStorage, login again

### **Issue: Ticket Backend Slow**
**Solution**: Render free tier sleeps after inactivity. Upgrade to Starter ($7/mo) for always-on

### **Issue: Database Connection Failed**
**Solution**: Verify AWS RDS security group allows Render's IP addresses

---

## 💰 **Cost Breakdown**

| Service | Provider | Tier | Cost |
|---------|----------|------|------|
| Main Frontend | Vercel | Free | $0 |
| Ticket Frontend | Vercel | Free | $0 |
| Main Backend | pydahsoft.in | ? | ? |
| Ticket Backend | Render | Free | $0 |
| **Total** | | | **$0/month** |

**Note**: Render free tier sleeps after 15 min inactivity. For production, consider Starter ($7/mo).

---

## 📞 **Support**

If you encounter issues:
1. Check Render logs: Service → **Logs** tab
2. Check Vercel logs: Deployment → **View Function Logs**
3. Test API endpoints directly with curl/Postman
4. Verify environment variables are set correctly

---

**🎉 Deployment Complete!**

Your ticket management system is now live and integrated with your main application via SSO!
