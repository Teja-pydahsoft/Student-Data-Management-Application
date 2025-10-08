# Deployment Guide - Student Database Management System

Complete guide to deploy your application to production.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Deployment Options](#deployment-options)
3. [Option 1: VPS/Cloud Server (Recommended)](#option-1-vpscloud-server)
4. [Option 2: Shared Hosting](#option-2-shared-hosting)
5. [Option 3: Platform as a Service (PaaS)](#option-3-platform-as-a-service)
6. [Post-Deployment Checklist](#post-deployment-checklist)

---

## Prerequisites

Before deploying, ensure you have:
- ✅ Domain name (optional but recommended)
- ✅ SSL certificate (Let's Encrypt is free)
- ✅ Server with Node.js and MySQL support
- ✅ Git installed (for code deployment)
- ✅ SSH access to your server

---

## Deployment Options

### Comparison Table

| Option | Cost | Difficulty | Best For |
|--------|------|------------|----------|
| VPS (DigitalOcean, AWS, Linode) | $5-20/month | Medium | Full control, scalable |
| Shared Hosting | $3-10/month | Easy | Small projects |
| PaaS (Heroku, Render) | Free-$25/month | Easy | Quick deployment |

---

## Option 1: VPS/Cloud Server (Recommended)

### Step 1: Choose a Provider
- **DigitalOcean** - $6/month (Recommended for beginners)
- **AWS EC2** - Free tier available
- **Linode** - $5/month
- **Vultr** - $5/month
- **Google Cloud** - Free tier available

### Step 2: Create a Server (Ubuntu 22.04 LTS)

**DigitalOcean Example:**
1. Create account at https://digitalocean.com
2. Create a Droplet:
   - Choose Ubuntu 22.04 LTS
   - Select $6/month plan (1GB RAM)
   - Choose datacenter region (closest to your users)
   - Add SSH key (recommended) or use password
3. Note your server IP address

### Step 3: Connect to Server

```bash
# Windows (PowerShell)
ssh root@your_server_ip

# Enter password when prompted
```

### Step 4: Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js (v18 LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Verify installation
node --version
npm --version

# Install MySQL
apt install mysql-server -y

# Secure MySQL installation
mysql_secure_installation
# Answer: Y to all questions
# Set a strong root password

# Install PM2 (Process Manager)
npm install -g pm2

# Install Nginx (Web Server)
apt install nginx -y

# Install Git
apt install git -y
```

### Step 5: Configure MySQL

```bash
# Login to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE student_database;
CREATE USER 'studentdb_user'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON student_database.* TO 'studentdb_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 6: Deploy Backend

```bash
# Create application directory
mkdir -p /var/www/student-db
cd /var/www/student-db

# Clone your code (if using Git)
# Option A: From GitHub
git clone https://github.com/yourusername/student-database.git .

# Option B: Upload files manually using SCP/SFTP
# From your local machine:
# scp -r "d:\Student Database Management\backend" root@your_server_ip:/var/www/student-db/
# scp -r "d:\Student Database Management\frontend" root@your_server_ip:/var/www/student-db/

# Navigate to backend
cd backend

# Install dependencies
npm install --production

# Create .env file
nano .env
```

**Backend .env configuration:**
```env
PORT=5000
NODE_ENV=production

DB_HOST=localhost
DB_USER=studentdb_user
DB_PASSWORD=your_strong_password
DB_NAME=student_database
DB_PORT=3306

JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

FRONTEND_URL=https://yourdomain.com
```

```bash
# Save and exit (Ctrl+X, Y, Enter)

# Initialize database
npm run init-db

# Start backend with PM2
pm2 start server.js --name student-db-backend
pm2 save
pm2 startup
# Copy and run the command it outputs
```

### Step 7: Deploy Frontend

```bash
# Navigate to frontend
cd /var/www/student-db/frontend

# Create .env file
nano .env
```

**Frontend .env configuration:**
```env
VITE_API_URL=https://yourdomain.com/api
```

```bash
# Save and exit

# Install dependencies
npm install

# Build for production
npm run build

# The build files are now in the 'dist' folder
```

### Step 8: Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/student-db
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Frontend
    location / {
        root /var/www/student-db/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:5000/health;
    }
}
```

```bash
# Save and exit

# Enable the site
ln -s /etc/nginx/sites-available/student-db /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Step 9: Setup SSL (HTTPS)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Auto-renewal is set up automatically
# Test renewal:
certbot renew --dry-run
```

### Step 10: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Check status
ufw status
```

### Step 11: Setup Automatic Backups

```bash
# Create backup script
nano /root/backup-database.sh
```

**Backup script:**
```bash
#!/bin/bash
BACKUP_DIR="/root/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
mysqldump -u studentdb_user -pyour_strong_password student_database > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Make executable
chmod +x /root/backup-database.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /root/backup-database.sh >> /var/log/backup.log 2>&1
```

---

## Option 2: Shared Hosting

### Requirements
- Node.js support (check with hosting provider)
- MySQL database
- SSH access (optional but helpful)

### Popular Providers
- **Hostinger** - Node.js hosting
- **A2 Hosting** - Node.js support
- **Bluehost** - VPS plans with Node.js

### Steps

1. **Upload Files**
   - Use FTP/SFTP to upload backend and frontend folders
   - Upload to public_html or www directory

2. **Setup Database**
   - Create MySQL database via cPanel
   - Import schema.sql
   - Note database credentials

3. **Configure Backend**
   - Update .env with database credentials
   - Install dependencies: `npm install`
   - Start with: `npm start` or use hosting's Node.js manager

4. **Build Frontend**
   - Run `npm run build` locally
   - Upload `dist` folder contents to public_html

5. **Configure Domain**
   - Point domain to hosting
   - Setup SSL via cPanel (Let's Encrypt)

---

## Option 3: Platform as a Service (PaaS)

### Render.com (Recommended - Free Tier Available)

**Backend Deployment:**

1. Create account at https://render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository or upload code
4. Configure:
   - **Name:** student-db-backend
   - **Environment:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
   - **Plan:** Free
5. Add Environment Variables:
   ```
   DB_HOST=your_mysql_host
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=student_database
   JWT_SECRET=your_secret_key
   FRONTEND_URL=https://your-frontend.onrender.com
   ```
6. Create MySQL database (use Render's managed database or external)
7. Deploy

**Frontend Deployment:**

1. Click "New +" → "Static Site"
2. Connect repository
3. Configure:
   - **Name:** student-db-frontend
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Publish Directory:** `frontend/dist`
4. Add Environment Variable:
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```
5. Deploy

### Heroku

**Backend:**
```bash
# Install Heroku CLI
# Create Heroku app
heroku create student-db-backend

# Add MySQL addon
heroku addons:create jawsdb:kitefin

# Set environment variables
heroku config:set JWT_SECRET=your_secret
heroku config:set FRONTEND_URL=https://your-frontend.herokuapp.com

# Deploy
git push heroku main
```

**Frontend:**
```bash
# Create frontend app
heroku create student-db-frontend

# Set buildpack
heroku buildpacks:set heroku/nodejs

# Add static buildpack
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-static

# Deploy
git push heroku main
```

### Vercel (Frontend Only)

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Deploy
vercel

# Follow prompts
# Set environment variable: VITE_API_URL
```

---

## Post-Deployment Checklist

### Security
- [ ] Change default admin password
- [ ] Use strong JWT_SECRET (minimum 32 characters)
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall
- [ ] Disable root SSH login
- [ ] Setup fail2ban (optional)
- [ ] Regular security updates

### Performance
- [ ] Enable Nginx gzip compression
- [ ] Setup CDN for static files (optional)
- [ ] Configure database indexes (already done)
- [ ] Monitor server resources
- [ ] Setup caching (Redis - optional)

### Monitoring
- [ ] Setup uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure error logging
- [ ] Setup PM2 monitoring: `pm2 monitor`
- [ ] Enable MySQL slow query log
- [ ] Setup backup verification

### Maintenance
- [ ] Document deployment process
- [ ] Setup automated backups
- [ ] Create restore procedure
- [ ] Schedule regular updates
- [ ] Monitor disk space
- [ ] Review logs regularly

### Testing
- [ ] Test all features in production
- [ ] Test form creation
- [ ] Test QR code generation
- [ ] Test form submission
- [ ] Test approval workflow
- [ ] Test on mobile devices
- [ ] Test SSL certificate
- [ ] Test backup and restore

---

## Useful Commands

### PM2 Commands
```bash
pm2 list                    # List all processes
pm2 logs student-db-backend # View logs
pm2 restart student-db-backend # Restart app
pm2 stop student-db-backend # Stop app
pm2 delete student-db-backend # Delete app
pm2 monit                   # Monitor resources
```

### Nginx Commands
```bash
nginx -t                    # Test configuration
systemctl restart nginx     # Restart Nginx
systemctl status nginx      # Check status
tail -f /var/log/nginx/error.log # View error logs
```

### MySQL Commands
```bash
mysql -u root -p            # Login to MySQL
mysqldump -u root -p student_database > backup.sql # Backup
mysql -u root -p student_database < backup.sql # Restore
```

### Server Maintenance
```bash
apt update && apt upgrade -y # Update system
df -h                       # Check disk space
free -m                     # Check memory
top                         # View processes
htop                        # Better process viewer (install first)
```

---

## Troubleshooting

### Backend Not Starting
```bash
# Check logs
pm2 logs student-db-backend

# Check if port is in use
netstat -tulpn | grep 5000

# Restart
pm2 restart student-db-backend
```

### Database Connection Issues
```bash
# Test MySQL connection
mysql -u studentdb_user -p student_database

# Check MySQL status
systemctl status mysql

# Restart MySQL
systemctl restart mysql
```

### Nginx Issues
```bash
# Test configuration
nginx -t

# Check error logs
tail -f /var/log/nginx/error.log

# Restart Nginx
systemctl restart nginx
```

### SSL Certificate Issues
```bash
# Renew certificate
certbot renew

# Check certificate status
certbot certificates
```

---

## Cost Estimation

### Monthly Costs (USD)

**Option 1: VPS (DigitalOcean)**
- Server: $6/month
- Domain: $12/year (~$1/month)
- SSL: Free (Let's Encrypt)
- **Total: ~$7/month**

**Option 2: Shared Hosting**
- Hosting: $5-10/month
- Domain: Included or $12/year
- SSL: Free
- **Total: ~$5-10/month**

**Option 3: PaaS (Render/Heroku)**
- Backend: Free or $7/month
- Frontend: Free
- Database: Free or $5/month
- **Total: Free or ~$12/month**

---

## Support Resources

- **DigitalOcean Tutorials:** https://www.digitalocean.com/community/tutorials
- **Nginx Documentation:** https://nginx.org/en/docs/
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/
- **Let's Encrypt:** https://letsencrypt.org/
- **Node.js Best Practices:** https://github.com/goldbergyoni/nodebestpractices

---

## Next Steps After Deployment

1. **Test Everything**
   - Create test forms
   - Submit test data
   - Verify approval workflow

2. **Setup Monitoring**
   - UptimeRobot for uptime monitoring
   - Google Analytics (optional)
   - Error tracking (Sentry - optional)

3. **Backup Strategy**
   - Automated daily backups
   - Weekly full backups
   - Test restore procedure

4. **Documentation**
   - Document your deployment
   - Create admin guide
   - Create user guide

5. **Launch**
   - Announce to users
   - Provide QR codes
   - Monitor initial usage

---

**Congratulations! Your Student Database Management System is now live! 🎉**
