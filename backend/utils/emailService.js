/**
 * Brevo Email Service using API
 * Uses Brevo REST API to send transactional emails
 */

// App configuration from environment
const appName = process.env.APP_NAME || 'Pydah Student Database';
const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send email via Brevo API
 */
const sendBrevoEmail = async ({ to, toName, subject, htmlContent }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'team@pydahsoft.in';
  const senderName = process.env.EMAIL_SENDER_NAME || 'Pydah Student Database';

  console.log('📧 Sending email via Brevo API:', {
    to,
    from: senderEmail,
    apiKey: apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT SET'
  });

  if (!apiKey) {
    const errorMsg = 'Email service not configured - BREVO_API_KEY missing in environment variables';
    console.warn('⚠️ BREVO_API_KEY not set in .env');
    console.warn('⚠️ Please add BREVO_API_KEY to your .env file');
    return { success: false, message: errorMsg, errorCode: 'EMAIL_CONFIG_MISSING' };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    const errorMsg = `Invalid email address: ${to}`;
    console.error('❌ Invalid email address:', to);
    return { success: false, message: errorMsg, errorCode: 'INVALID_EMAIL' };
  }

  if (!emailRegex.test(senderEmail)) {
    const errorMsg = `Invalid sender email: ${senderEmail}`;
    console.error('❌ Invalid sender email:', senderEmail);
    return { success: false, message: errorMsg, errorCode: 'INVALID_SENDER_EMAIL' };
  }

  try {
    // Brevo API endpoint for sending transactional emails
    const https = require('https');
    const { URL } = require('url');
    
    const apiUrl = 'https://api.brevo.com/v3/smtp/email';
    
    const emailData = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: to,
          name: toName || to
        }
      ],
      subject: subject,
      htmlContent: htmlContent
    };

    const postData = JSON.stringify(emailData);
    const urlObj = new URL(apiUrl);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(postData)
      }
    };

    const responseData = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ 
              status: res.statusCode, 
              ok: res.statusCode >= 200 && res.statusCode < 300, 
              data: parsed 
            });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${e.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    const response = responseData;

    if (!response.ok) {
      let errorMsg = response.data?.message || `API request failed with status ${response.status}`;
      let errorCode = 'EMAIL_SEND_FAILED';
      
      console.error('❌ Brevo API error:', {
        status: response.status,
        error: response.data
      });
      
      if (response.status === 401) {
        errorCode = 'API_AUTH_FAILED';
        
        // Check for IP address restriction error
        if (response.data?.message && response.data.message.includes('unrecognised IP address')) {
          const ipMatch = response.data.message.match(/IP address (\d+\.\d+\.\d+\.\d+)/);
          const ipAddress = ipMatch ? ipMatch[1] : 'your current IP';
          
          errorMsg = `Brevo API: IP address not authorized. 
          
Your current IP address (${ipAddress}) is not authorized in your Brevo account.

To fix this:
1. Go to https://app.brevo.com/security/authorised_ips
2. Add your IP address: ${ipAddress}
3. Or disable IP restrictions in Brevo security settings

Note: If your IP changes frequently, consider disabling IP restrictions in Brevo settings.`;
        } else {
          errorMsg = `Brevo API authentication failed. Please check your BREVO_API_KEY is correct and valid.`;
        }
      } else if (response.status === 400) {
        errorCode = 'INVALID_REQUEST';
        errorMsg = `Invalid request: ${errorMsg}`;
      } else if (response.status === 402) {
        errorCode = 'QUOTA_EXCEEDED';
        errorMsg = `Brevo API quota exceeded. Please check your Brevo account limits.`;
      } else if (response.status === 403) {
        errorCode = 'FORBIDDEN';
        errorMsg = `Brevo API: Access forbidden. Please check your API key permissions.`;
      } else if (response.status === 404) {
        errorCode = 'NOT_FOUND';
        errorMsg = `Brevo API endpoint not found.`;
      } else if (response.status >= 500) {
        errorCode = 'SERVER_ERROR';
        errorMsg = `Brevo API server error. Please try again later.`;
      }

      return { 
        success: false, 
        message: errorMsg, 
        errorCode,
        apiResponse: response.data
      };
    }

    console.log(`✅ Email sent successfully to ${to} (Message ID: ${response.data?.messageId || 'N/A'})`);
    return { 
      success: true, 
      message: 'Email sent successfully', 
      messageId: response.data?.messageId 
    };

  } catch (error) {
    let errorMessage = error.message;
    let errorCode = 'EMAIL_SEND_FAILED';
    
    // Provide more specific error messages
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Failed to connect to Brevo API. Please check your network connection.';
      errorCode = 'API_CONNECTION_FAILED';
    } else if (error.message && error.message.includes('fetch')) {
      errorMessage = 'Network error while sending email. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    }
    
    console.error('❌ Failed to send email:', {
      to,
      error: errorMessage,
      code: error.code,
      stack: error.stack
    });
    
    return { success: false, message: errorMessage, errorCode };
  }
};

/**
 * Send user credentials email
 */
const sendCredentialsEmail = async ({ email, name, username, password, role }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .credentials-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .credential-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
        .credential-item:last-child { border-bottom: none; }
        .credential-label { color: #64748b; font-weight: 600; }
        .credential-value { color: #1e293b; font-family: monospace; background: #e2e8f0; padding: 4px 12px; border-radius: 4px; }
        .role-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-top: 20px; color: #92400e; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 ${appName}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your Account Has Been Created</p>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your account has been created successfully. Below are your login credentials:</p>
          
          <div class="credentials-box">
            <div class="credential-item">
              <span class="credential-label">Username</span>
              <span class="credential-value">${username}</span>
            </div>
            <div class="credential-item">
              <span class="credential-label">Password</span>
              <span class="credential-value">${password}</span>
            </div>
            <div class="credential-item">
              <span class="credential-label">Role</span>
              <span class="role-badge">${role}</span>
            </div>
          </div>
          
          <center>
            <a href="${appUrl}/login" class="cta-button">Login to Your Account</a>
          </center>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> For security reasons, please change your password after your first login.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendBrevoEmail({
    to: email,
    toName: name,
    subject: `Your ${appName} Account Credentials`,
    htmlContent
  });
};

/**
 * Send password reset email with new password
 */
const sendPasswordResetEmail = async ({ email, name, username, newPassword, role }) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .credentials-box { background: #fffbeb; border: 2px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .credential-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #fcd34d; }
        .credential-item:last-child { border-bottom: none; }
        .credential-label { color: #92400e; font-weight: 600; }
        .credential-value { color: #1e293b; font-family: monospace; background: #fef3c7; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
        .role-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
        .footer { background: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }
        .warning { background: #fee2e2; border: 1px solid #f87171; border-radius: 8px; padding: 15px; margin-top: 20px; color: #b91c1c; }
        .info-box { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #1e40af; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${appName}</p>
        </div>
        <div class="content">
          <p>Hello <strong>${name}</strong>,</p>
          
          <div class="info-box">
            <strong>ℹ️ Password Reset Request:</strong> Your password has been reset by the administrator.
          </div>
          
          <p>Your new login credentials are:</p>
          
          <div class="credentials-box">
            <div class="credential-item">
              <span class="credential-label">Username</span>
              <span class="credential-value">${username}</span>
            </div>
            <div class="credential-item">
              <span class="credential-label">New Password</span>
              <span class="credential-value">${newPassword}</span>
            </div>
            <div class="credential-item">
              <span class="credential-label">Role</span>
              <span class="role-badge">${role}</span>
            </div>
          </div>
          
          <center>
            <a href="${appUrl}/login" class="cta-button">Login with New Password</a>
          </center>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> Please change your password immediately after logging in. If you did not request this password reset, contact your administrator immediately.
          </div>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendBrevoEmail({
    to: email,
    toName: name,
    subject: `Password Reset - ${appName}`,
    htmlContent
  });
};

module.exports = {
  sendCredentialsEmail,
  sendPasswordResetEmail,
  sendBrevoEmail
};
