# AWS Lightsail Quick Start Guide

## 🚀 Quick Deployment Summary

This is a condensed version of the full deployment guide. For detailed instructions, see [AWS_LIGHTSAIL_DEPLOYMENT_GUIDE.md](./AWS_LIGHTSAIL_DEPLOYMENT_GUIDE.md).

---

## Step 1: Create Lightsail Instance (5 minutes)

1. Go to [AWS Lightsail Console](https://lightsail.aws.amazon.com)
2. Click **"Create instance"**
3. Choose:
   - **Platform**: Linux/Unix
   - **Blueprint**: Node.js or Ubuntu 22.04 LTS
   - **Plan**: $5/month (1 GB RAM) - recommended
   - **Name**: `student-db-backend`
4. Click **"Create instance"**
5. Wait for instance to start (2-3 minutes)

---

## Step 2: Connect to Server (2 minutes)

1. Click on your instance
2. Click **"Connect using SSH"** tab
3. Click **"Connect using SSH"** button (browser terminal)
4. Or use SSH from your computer:
   ```bash
   ssh -i your-key.pem bitnami@your-instance-ip
   ```

---

## Step 3: Initial Server Setup (10 minutes)

Run these commands on your server:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not pre-installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install Git
sudo apt install git -y

# Configure firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 5000/tcp
sudo ufw enable
```

---

## Step 4: Deploy Application (10 minutes)

```bash
# Create app directory
sudo mkdir -p /var/www/student-db-backend
sudo chown -R $USER:$USER /var/www/student-db-backend
cd /var/www/student-db-backend

# Clone repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git .

# Navigate to backend
cd backend

# Install dependencies
npm install --production

# Create .env file
nano .env
```

**Paste your environment variables** (see ENV_CONFIGURATION.txt for reference)

```bash
# Save and exit (Ctrl+X, Y, Enter)

# Start with PM2
pm2 start server.js --name student-db-backend
pm2 save
pm2 startup
# Copy and run the command it outputs
```

---

## Step 5: Setup GitHub Actions CI/CD (5 minutes)

### 5.1: Add GitHub Secrets

1. Go to GitHub → Your repository → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

   - **LIGHTSAIL_HOST**: Your instance IP (e.g., `54.123.45.67`)
   - **LIGHTSAIL_USER**: `bitnami` or `ubuntu`
   - **LIGHTSAIL_SSH_KEY**: Your private SSH key (download from Lightsail)
   - **LIGHTSAIL_APP_PATH**: `/var/www/student-db-backend`

### 5.2: Verify Workflow File

The workflow file `.github/workflows/deploy-lightsail.yml` should already be in your repository.

### 5.3: Test Deployment

```bash
# Make a small change
echo "# Test" >> backend/README.md

# Commit and push
git add .
git commit -m "Test CI/CD"
git push origin main
```

Check GitHub → **Actions** tab to see deployment progress.

---

## Step 6: Setup Domain & SSL (Optional - 10 minutes)

### 6.1: Point Domain to Lightsail

1. Lightsail Console → **Networking** → **DNS zones**
2. Create DNS zone for your domain
3. Add A record pointing to your instance IP
4. Update nameservers at your domain registrar

### 6.2: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/student-db-backend
```

**Paste:**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

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
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/student-db-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.yourdomain.com
```

---

## ✅ Verify Deployment

```bash
# Check application status
pm2 list
pm2 logs student-db-backend

# Test health endpoint
curl http://localhost:5000/health
```

Visit: `http://your-instance-ip:5000/health` or `https://api.yourdomain.com/health`

---

## 🔄 Automatic Deployment

Now, whenever you push to `main` branch:

1. GitHub Actions automatically triggers
2. Code is pulled on server
3. Dependencies are updated
4. Application is restarted
5. Health check verifies deployment

**That's it!** Your changes will be live in 2-5 minutes after pushing to GitHub.

---

## 🆘 Troubleshooting

### Application not starting?
```bash
pm2 logs student-db-backend
pm2 restart student-db-backend
```

### GitHub Actions failing?
- Check SSH key in GitHub secrets
- Verify instance IP is correct
- Check Actions tab for error messages

### Can't access application?
- Check firewall: `sudo ufw status`
- Check Lightsail networking (ports 80, 443, 5000)
- Verify PM2: `pm2 list`

---

## 📚 Full Documentation

- **Complete Guide**: [AWS_LIGHTSAIL_DEPLOYMENT_GUIDE.md](./AWS_LIGHTSAIL_DEPLOYMENT_GUIDE.md)
- **Checklist**: [QUICK_DEPLOYMENT_CHECKLIST.md](./QUICK_DEPLOYMENT_CHECKLIST.md)
- **Environment Variables**: [ENV_CONFIGURATION.txt](./ENV_CONFIGURATION.txt)

---

**Need Help?** Check the troubleshooting section in the full deployment guide.

