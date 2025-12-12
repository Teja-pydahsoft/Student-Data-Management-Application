#!/bin/bash

# AWS Lightsail Deployment Script
# This script can be run manually on the server or used as reference

set -e  # Exit on error

echo "🚀 Starting deployment process..."

# Configuration
APP_DIR="/var/www/student-db-backend"
BACKEND_DIR="$APP_DIR/backend"
PM2_APP_NAME="student-db-backend"

# Navigate to application directory
cd "$APP_DIR" || exit 1

echo "📥 Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main || git reset --hard origin/master

# Navigate to backend directory
cd "$BACKEND_DIR" || exit 1

echo "📦 Installing dependencies..."
npm ci --production

# Run database migrations if needed (uncomment if you have migrations)
# echo "🗄️ Running database migrations..."
# npm run migrate || echo "No migrations to run"

# Restart the application with PM2
echo "🔄 Restarting application..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
    pm2 restart "$PM2_APP_NAME"
else
    pm2 start server.js --name "$PM2_APP_NAME"
fi

# Save PM2 process list
pm2 save

# Wait a moment for the app to start
sleep 3

# Verify deployment
echo "✅ Verifying deployment..."
if pm2 list | grep -q "$PM2_APP_NAME.*online"; then
    echo "✅ Application is running successfully!"
    
    # Test health endpoint
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo "✅ Health check passed!"
    else
        echo "⚠️ Health check failed, but application is running"
    fi
else
    echo "❌ Application failed to start!"
    pm2 logs "$PM2_APP_NAME" --lines 50 --nostream
    exit 1
fi

echo "🎉 Deployment complete!"

