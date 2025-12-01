# Google Drive Service Account Environment Configuration

This guide explains how to configure Google Drive Service Account authentication using environment variables instead of a physical JSON file.

## Environment Variables Structure

### Google Service Account Variables

Add these variables to your `backend/.env` file:

```env
# Google Service Account Configuration
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_CLIENT_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com

# Google Drive Configuration
DRIVE_MAIN_FOLDER_ID=1bfjkg0mtNFGDjiswdv9ljtlw-7QgU35O

# App Environment
NODE_ENV=production

# MySQL Database Configuration
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name
```

## How to Extract Values from Service Account JSON

1. **Download your Service Account JSON** from Google Cloud Console
2. **Extract each value** from the JSON file:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",           → GOOGLE_PROJECT_ID
  "private_key_id": "your-private-key-id",   → GOOGLE_PRIVATE_KEY_ID
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  → GOOGLE_PRIVATE_KEY
  "client_email": "your-service-account@...", → GOOGLE_CLIENT_EMAIL
  "client_id": "your-client-id",             → GOOGLE_CLIENT_ID
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",  → GOOGLE_AUTH_URI
  "token_uri": "https://oauth2.googleapis.com/token",        → GOOGLE_TOKEN_URI
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",  → GOOGLE_AUTH_PROVIDER_X509_CERT_URL
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."  → GOOGLE_CLIENT_CERT_URL
}
```

## Private Key Formatting Instructions

### ⚠️ CRITICAL: Private Key Escaping

The private key contains newlines that must be properly escaped in `.env` files.

#### Method 1: Using `\n` (Recommended)
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n...more lines...\n-----END PRIVATE KEY-----\n"
```

**Important Rules:**
- Wrap the entire key in **double quotes** `"`
- Replace actual newlines with `\n` (backslash + n)
- Keep the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
- Add `\n` at the end after the closing marker

#### Method 2: Single Line (Alternative)
If your `.env` parser doesn't support `\n`, you can use a single line:
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY----- MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC... -----END PRIVATE KEY-----"
```
Then in code, replace spaces with newlines when reconstructing.

### How to Convert JSON Private Key to .env Format

**Step-by-step:**

1. Open your Service Account JSON file
2. Find the `"private_key"` field
3. Copy the entire value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
4. Replace each actual newline with `\n`
5. Wrap in double quotes

**Example:**
```json
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

Becomes in `.env`:
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

## Backend Integration

The backend will automatically reconstruct the service account object from these environment variables. See `backend/services/googleDriveService.js` for implementation details.

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use environment-specific files**: `.env.development`, `.env.production`
3. **Restrict access** to `.env` files (file permissions: 600)
4. **Rotate keys regularly** for production environments
5. **Use secret management services** (AWS Secrets Manager, Azure Key Vault, etc.) in production

## Troubleshooting

### Issue: "Invalid private key format"
- **Solution**: Ensure the private key uses `\n` for newlines, not actual newlines
- **Check**: Verify the key is wrapped in double quotes

### Issue: "Service account not found"
- **Solution**: Verify `GOOGLE_CLIENT_EMAIL` matches the service account email
- **Check**: Ensure the service account has Drive API access enabled

### Issue: "Permission denied"
- **Solution**: Share the Drive folder with the service account email
- **Check**: Verify `DRIVE_MAIN_FOLDER_ID` is correct and accessible

## Testing

After setting up environment variables, test the connection:

```bash
# In backend directory
node -e "require('dotenv').config(); const service = require('./services/googleDriveService'); service.testConnection().then(() => console.log('✅ Connected')).catch(e => console.error('❌ Error:', e.message));"
```

