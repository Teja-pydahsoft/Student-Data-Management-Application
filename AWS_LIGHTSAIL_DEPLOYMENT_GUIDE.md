# AWS Lightsail Deployment Guide - Complete Step-by-Step Instructions

This guide will help you deploy your backend application to AWS Lightsail and set up automatic deployment from GitHub.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Part 1: AWS Lightsail Setup](#part-1-aws-lightsail-setup)
3. [Part 2: Server Configuration](#part-2-server-configuration)
4. [Part 3: Application Deployment](#part-3-application-deployment)
5. [Part 4: GitHub Actions CI/CD Setup](#part-4-github-actions-cicd-setup)
6. [Part 5: Domain & SSL Setup](#part-5-domain--ssl-setup)
7. [Troubleshooting](#troubleshooting)
8. [Useful Commands](#useful-commands)

---

## Prerequisites

Before starting, ensure you have:

- ✅ AWS Account (create at https://aws.amazon.com)
- ✅ GitHub Account with your repository
- ✅ Domain name (optional but recommended)
- ✅ Basic knowledge of Linux commands
- ✅ SSH client (Windows: PowerShell/CMD, Mac/Linux: Terminal)

---

## Part 1: AWS Lightsail Setup

### Step 1.1: Create AWS Account

1. Go to https://aws.amazon.com
2. Click "Create an AWS Account"
3. Follow the registration process
4. Complete payment verification (credit card required, but Lightsail has free tier)

### Step 1.2: Create Lightsail Instance

1. **Login to AWS Console**
   - Go to https://console.aws.amazon.com
   - Search for "Lightsail" in the search bar
   - Click on "Lightsail"

2. **Create Instance**
   - Click "Create instance" button
   - **Choose instance location**: Select region closest to your users
   - **Choose your instance image**: 
     - Platform: Linux/Unix
     - Blueprint: Node.js (or Ubuntu 22.04 LTS if Node.js not available)
   - **Choose your instance plan**: 
     - Start with **$3.50/month** (512 MB RAM) for testing
     - Or **$5/month** (1 GB RAM) for production (recommended)
   - **Identify your instance**: 
     - Name: `student-db-backend` (or your preferred name)
   - Click **"Create instance"**

3. **Wait for Instance to Start**
   - Wait 2-3 minutes for instance to be ready
   - Status will change from "Pending" to "Running"

### Step 1.3: Get Connection Details

1. Click on your instance name
2. Click **"Connect using SSH"** tab
3. You'll see connection details:
   - **Username**: Usually `bitnami` (for Node.js) or `ubuntu` (for Ubuntu)
   - **IP Address**: Note this down (e.g., `54.123.45.67`)
   - **SSH Key**: Download if using browser SSH

### Step 1.4: Connect to Your Instance

**Option A: Using Browser SSH (Easiest)**
- Click "Connect using SSH" button in Lightsail console
- Browser terminal will open

**Option B: Using PowerShell/CMD (Windows)**
```powershell
# Download SSH key from Lightsail first, then:
ssh -i path/to/your-key.pem bitnami@your-instance-ip
# or
ssh -i path/to/your-key.pem ubuntu@your-instance-ip
```

**Option C: Using Terminal (Mac/Linux)**
```bash
ssh -i ~/path/to/your-key.pem bitnami@your-instance-ip
# or
ssh -i ~/path/to/your-key.pem ubuntu@your-instance-ip
```

---

## Part 2: Server Configuration

### Step 2.1: Update System

```bash
# Update package list
sudo apt update && sudo apt upgrade -y
```

### Step 2.2: Install Node.js (if not pre-installed)

```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed, install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### Step 2.3: Install MySQL (if using local database)

**Note**: If you're using AWS RDS, skip this step.

```bash
# Install MySQL
sudo apt install mysql-server -y

# Secure MySQL installation
sudo mysql_secure_installation
# Answer: Y to all questions
# Set a strong root password (save it securely!)

# Login to MySQL
sudo mysql -u root -p

# Create database and user
CREATE DATABASE student_database;
CREATE USER 'studentdb_user'@'localhost' IDENTIFIED BY 'your_strong_password_here';
GRANT ALL PRIVILEGES ON student_database.* TO 'studentdb_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 2.4: Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 2.5: Install Nginx (Web Server)

```bash
# Install Nginx
sudo apt install nginx -y

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Step 2.6: Install Git

```bash
# Install Git
sudo apt install git -y

# Verify
git --version
```

### Step 2.7: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 5000/tcp  # For backend API

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Part 3: Application Deployment

### Step 3.1: Create Application Directory

```bash
# Create directory for your application
sudo mkdir -p /var/www/student-db-backend
sudo chown -R $USER:$USER /var/www/student-db-backend
cd /var/www/student-db-backend
```

### Step 3.2: Clone Your Repository

```bash
# Clone your GitHub repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git .

# If repository is private, you'll need to set up SSH keys or use personal access token
# For private repos with token:
# git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO_NAME.git .
```

### Step 3.3: Navigate to Backend Directory

```bash
cd backend
```

### Step 3.4: Install Dependencies

```bash
# Install production dependencies
npm install --production
```

### Step 3.5: Create Environment File

```bash
# Create .env file
nano .env
```

**Add the following content** (replace with your actual values):

```env
PORT=5000
NODE_ENV=production

# Database Configuration
# If using AWS RDS:
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=your_rds_password
DB_NAME=student_database
DB_SSL=true

# If using local MySQL:
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=studentdb_user
# DB_PASSWORD=your_strong_password
# DB_NAME=student_database
# DB_SSL=false

# Authentication
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long_change_this
JWT_EXPIRES_IN=24h

# Default Admin Credentials (change these!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# CORS Configuration
FRONTEND_URL=https://your-frontend-domain.com
# Or multiple URLs (comma-separated):
# FRONTEND_URLS=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# AWS S3 Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
S3_BUCKET_NAME=your_s3_bucket_name

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Logging
LOG_LEVEL=warn
```

**Save and exit:**
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter` to save

### Step 3.6: Initialize Database (if needed)

```bash
# Run database initialization script
npm run init-db
```

### Step 3.7: Start Application with PM2

```bash
# Start the application
pm2 start server.js --name student-db-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs (usually starts with 'sudo env PATH=...')
```

### Step 3.8: Verify Application is Running

```bash
# Check PM2 status
pm2 list

# Check logs
pm2 logs student-db-backend

# Test the application
curl http://localhost:5000/health
```

You should see a JSON response with server status.

---

## Part 4: GitHub Actions CI/CD Setup

### Step 4.1: Create GitHub Actions Workflow

1. **In your local repository**, create the workflow file:

**Create directory structure:**
```bash
# On your local machine (Windows PowerShell)
mkdir -p .github\workflows
```

2. **Create the workflow file** (see next section for content)

### Step 4.2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add the following secrets:

   - **Name**: `LIGHTSAIL_HOST`
     - **Value**: Your Lightsail instance IP (e.g., `54.123.45.67`)

   - **Name**: `LIGHTSAIL_USER`
     - **Value**: Your SSH username (usually `bitnami` or `ubuntu`)

   - **Name**: `LIGHTSAIL_SSH_KEY`
     - **Value**: Your private SSH key content
     - To get your SSH key:
       - In Lightsail console → Your instance → **"Connect using SSH"** tab
       - Click **"Download default key"** or use existing key
       - Open the `.pem` file in a text editor
       - Copy the entire content (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

   - **Name**: `LIGHTSAIL_APP_PATH`
     - **Value**: `/var/www/student-db-backend`

### Step 4.3: Test the Workflow

1. Make a small change to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Test CI/CD deployment"
   git push origin main
   ```
3. Go to GitHub → Your repository → **Actions** tab
4. You should see a workflow running
5. Wait for it to complete (should take 2-5 minutes)
6. Check your server to verify the deployment

---

## Part 5: Domain & SSL Setup

### Step 5.1: Point Domain to Lightsail

1. **In Lightsail Console:**
   - Go to **Networking** → **DNS zones**
   - Click **"Create DNS zone"**
   - Enter your domain name (e.g., `yourdomain.com`)
   - Click **"Create DNS zone"**

2. **Add A Record:**
   - Click on your DNS zone
   - Click **"Add record"**
   - Type: `A`
   - Subdomain: `api` (or leave blank for root domain)
   - Maps to: Your Lightsail instance IP
   - Click **"Save"**

3. **Update Nameservers:**
   - Copy the nameservers shown in Lightsail
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Update nameservers to the ones from Lightsail

### Step 5.2: Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/student-db-backend
```

**Add this configuration:**

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Replace with your domain

    # Backend API
    location / {
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

**Save and exit** (Ctrl+X, Y, Enter)

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/student-db-backend /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 5.3: Setup SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com

# Follow prompts:
# - Enter email address
# - Agree to terms (A)
# - Choose to redirect HTTP to HTTPS (2)

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 5.4: Update Environment Variables

```bash
# Update .env file with your domain
cd /var/www/student-db-backend/backend
nano .env
```

Update `FRONTEND_URL` to your actual frontend domain:
```env
FRONTEND_URL=https://your-frontend-domain.com
```

```bash
# Restart the application
pm2 restart student-db-backend
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs student-db-backend

# Check if port is in use
sudo netstat -tulpn | grep 5000

# Restart application
pm2 restart student-db-backend
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -u studentdb_user -p student_database

# Check MySQL status
sudo systemctl status mysql

# Restart MySQL
sudo systemctl restart mysql
```

### Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### GitHub Actions Deployment Fails

1. **Check SSH Key:**
   - Ensure the SSH key in GitHub secrets is correct
   - Make sure it includes the header and footer lines

2. **Check Permissions:**
   ```bash
   # On server, ensure directory is writable
   sudo chown -R $USER:$USER /var/www/student-db-backend
   ```

3. **Check GitHub Actions Logs:**
   - Go to GitHub → Actions → Click on failed workflow
   - Review error messages

### Cannot Access Application

1. **Check Firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 5000/tcp
   ```

2. **Check Lightsail Firewall:**
   - In Lightsail console → Your instance → **Networking** tab
   - Ensure ports 80, 443, and 5000 are open

3. **Check Application Status:**
   ```bash
   pm2 status
   curl http://localhost:5000/health
   ```

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
pm2 save                    # Save current process list
```

### Nginx Commands

```bash
sudo nginx -t                    # Test configuration
sudo systemctl restart nginx     # Restart Nginx
sudo systemctl status nginx      # Check status
sudo tail -f /var/log/nginx/error.log # View error logs
```

### Git Commands

```bash
cd /var/www/student-db-backend
git pull origin main             # Pull latest changes
git status                       # Check status
git log                          # View commit history
```

### System Commands

```bash
sudo apt update && sudo apt upgrade -y  # Update system
df -h                              # Check disk space
free -m                            # Check memory
top                                # View processes
```

---

## Next Steps

1. ✅ **Test Your API**: Visit `https://api.yourdomain.com/health`
2. ✅ **Update Frontend**: Point your frontend to the new backend URL
3. ✅ **Monitor Logs**: Regularly check `pm2 logs`
4. ✅ **Setup Backups**: Configure database backups
5. ✅ **Monitor Performance**: Use PM2 monitoring or AWS CloudWatch

---

## Cost Estimation

- **Lightsail Instance**: $3.50-$5/month (depending on plan)
- **Domain**: $10-15/year (optional)
- **SSL Certificate**: Free (Let's Encrypt)
- **Total**: ~$4-6/month

---

**Congratulations! Your backend is now deployed on AWS Lightsail with automatic CI/CD! 🎉**

