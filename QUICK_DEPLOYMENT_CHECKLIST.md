# Quick Deployment Checklist - AWS Lightsail

Use this checklist to ensure you complete all steps correctly.

## Pre-Deployment

- [ ] AWS account created
- [ ] GitHub repository is ready
- [ ] Domain name purchased (optional)
- [ ] AWS credentials for S3 access ready
- [ ] Database credentials ready (RDS or local MySQL)

## AWS Lightsail Setup

- [ ] Lightsail instance created
- [ ] Instance is running
- [ ] SSH connection tested
- [ ] Instance IP address noted

## Server Configuration

- [ ] System updated (`sudo apt update && sudo apt upgrade -y`)
- [ ] Node.js installed (v18.x)
- [ ] MySQL installed (if using local database)
- [ ] PM2 installed globally
- [ ] Nginx installed
- [ ] Git installed
- [ ] Firewall configured (ports 22, 80, 443, 5000)

## Application Deployment

- [ ] Application directory created (`/var/www/student-db-backend`)
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install --production`)
- [ ] `.env` file created with all required variables
- [ ] Database initialized (if needed)
- [ ] Application started with PM2
- [ ] PM2 startup configured
- [ ] Health check working (`curl http://localhost:5000/health`)

## GitHub Actions CI/CD

- [ ] `.github/workflows/deploy-lightsail.yml` file created
- [ ] GitHub secrets added:
  - [ ] `LIGHTSAIL_HOST`
  - [ ] `LIGHTSAIL_USER`
  - [ ] `LIGHTSAIL_SSH_KEY`
  - [ ] `LIGHTSAIL_APP_PATH`
- [ ] Workflow tested (push to main branch)
- [ ] Deployment successful

## Domain & SSL

- [ ] DNS zone created in Lightsail
- [ ] A record added pointing to instance IP
- [ ] Nameservers updated at domain registrar
- [ ] Nginx configured for domain
- [ ] SSL certificate obtained (Certbot)
- [ ] HTTPS working

## Environment Variables Checklist

Ensure all these are set in your `.env` file:

- [ ] `PORT=5000`
- [ ] `NODE_ENV=production`
- [ ] `DB_HOST` (RDS endpoint or localhost)
- [ ] `DB_PORT=3306`
- [ ] `DB_USER`
- [ ] `DB_PASSWORD`
- [ ] `DB_NAME=student_database`
- [ ] `DB_SSL` (true for RDS, false for local)
- [ ] `JWT_SECRET` (32+ characters)
- [ ] `ADMIN_USERNAME`
- [ ] `ADMIN_PASSWORD`
- [ ] `FRONTEND_URL` or `FRONTEND_URLS`
- [ ] `AWS_REGION`
- [ ] `AWS_ACCESS_KEY_ID`
- [ ] `AWS_SECRET_ACCESS_KEY`
- [ ] `S3_BUCKET_NAME`

## Security

- [ ] Strong passwords set for database and admin
- [ ] JWT_SECRET is secure and random
- [ ] SSH key secured (not committed to Git)
- [ ] Firewall enabled
- [ ] SSL certificate active
- [ ] Environment variables not committed to Git

## Testing

- [ ] Health endpoint accessible (`/health`)
- [ ] Database connection working
- [ ] API endpoints responding
- [ ] CORS configured correctly
- [ ] File uploads working (S3)
- [ ] Authentication working
- [ ] Frontend can connect to backend

## Post-Deployment

- [ ] Monitoring setup (PM2 monitoring or CloudWatch)
- [ ] Backup strategy configured
- [ ] Logs accessible
- [ ] Documentation updated
- [ ] Team notified of deployment

## Troubleshooting Reference

If something fails, check:

1. **Application not starting**: `pm2 logs student-db-backend`
2. **Database issues**: `sudo systemctl status mysql`
3. **Nginx issues**: `sudo nginx -t` and `sudo tail -f /var/log/nginx/error.log`
4. **GitHub Actions failing**: Check Actions tab in GitHub
5. **Connection issues**: Check firewall and Lightsail networking

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Failed

