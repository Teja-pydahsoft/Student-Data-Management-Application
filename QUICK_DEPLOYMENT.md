# Quick Deployment Guide

## 🚀 Fastest Way to Deploy (5 Steps)

### Option 1: Render.com (Free - Easiest)

**1. Create Account**
- Go to https://render.com
- Sign up with GitHub/Email

**2. Deploy Backend**
- Click "New +" → "Web Service"
- Upload your `backend` folder or connect GitHub
- Settings:
  - Build: `npm install`
  - Start: `npm start`
  - Add environment variables from `.env.example`
- Click "Create Web Service"
- Note the URL: `https://your-app.onrender.com`

**3. Setup Database**
- Use Render's PostgreSQL (free) or external MySQL
- Update backend environment variables with DB credentials
- Run database initialization manually

**4. Deploy Frontend**
- Click "New +" → "Static Site"
- Upload `frontend` folder
- Settings:
  - Build: `npm install && npm run build`
  - Publish: `dist`
  - Environment: `VITE_API_URL=https://your-backend.onrender.com/api`
- Click "Create Static Site"

**5. Done!**
- Access your app at the provided URL
- Login with admin credentials
- Start creating forms!

---

### Option 2: DigitalOcean (VPS - $6/month)

**1. Create Droplet**
```bash
# Choose Ubuntu 22.04, $6/month plan
# SSH into server
ssh root@your_server_ip
```

**2. Install Requirements**
```bash
# One-line installation
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
apt install -y nodejs mysql-server nginx && \
npm install -g pm2
```

**3. Setup Database**
```bash
mysql_secure_installation
mysql -u root -p
# CREATE DATABASE student_database;
# EXIT;
```

**4. Deploy Application**
```bash
# Upload files via SCP or Git
cd /var/www/student-db/backend
npm install
npm run init-db
pm2 start server.js --name student-db

cd ../frontend
npm install && npm run build
```

**5. Configure Nginx**
```bash
# Copy nginx config from DEPLOYMENT_GUIDE.md
# Setup SSL with certbot
certbot --nginx -d yourdomain.com
```

---

### Option 3: Vercel (Frontend) + Railway (Backend)

**Frontend (Vercel):**
```bash
npm install -g vercel
cd frontend
vercel
# Follow prompts
```

**Backend (Railway):**
- Go to https://railway.app
- Click "New Project" → "Deploy from GitHub"
- Select backend folder
- Add environment variables
- Deploy

---

## 📋 Pre-Deployment Checklist

- [ ] Change default admin password in `.env`
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Update FRONTEND_URL in backend `.env`
- [ ] Update VITE_API_URL in frontend `.env`
- [ ] Test locally before deploying
- [ ] Backup your code

---

## 🔑 Important Environment Variables

**Backend (.env):**
```env
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=strong_password
DB_NAME=student_database
JWT_SECRET=minimum_32_character_secret_key
FRONTEND_URL=https://yourdomain.com
```

**Frontend (.env):**
```env
VITE_API_URL=https://your-backend-url.com/api
```

---

## 🆘 Quick Troubleshooting

**Backend won't start:**
- Check database connection
- Verify environment variables
- Check logs: `pm2 logs` or check platform logs

**Frontend can't connect to backend:**
- Verify VITE_API_URL is correct
- Check CORS settings in backend
- Ensure backend is running

**Database errors:**
- Run `npm run init-db` in backend
- Check database credentials
- Ensure database exists

---

## 📞 Need Help?

Check the full **DEPLOYMENT_GUIDE.md** for detailed instructions.

---

**Your app will be live in ~15 minutes! 🎉**
