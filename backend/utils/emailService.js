/**
 * Brevo Email Service using API
 * Uses Brevo REST API to send transactional emails
 */

// App configuration from environment
const appName = process.env.APP_NAME || 'Pydah Student Database';

// Use production URL directly
const appUrl = 'https://pydahsdms.vercel.app';

const logoUrl = 'https://static.wixstatic.com/media/bfee2e_7d499a9b2c40442e85bb0fa99e7d5d37~mv2.png/v1/fill/w_162,h_89,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/logo1.png';

/**
 * Send email via Brevo API
 */
const sendBrevoEmail = async ({ to, toName, subject, htmlContent, attachments }) => {
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

    // Add attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      emailData.attachment = attachments.map(att => {
        if (typeof att === 'string') {
          // If it's a file path, read it
          const fs = require('fs');
          const path = require('path');
          const fileContent = fs.readFileSync(att);
          return {
            name: path.basename(att),
            content: fileContent.toString('base64')
          };
        } else if (att.content && att.name) {
          // If it's already an object with content and name
          return {
            name: att.name,
            content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content
          };
        }
        return null;
      }).filter(Boolean);
    }

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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          background-color: #f5f7fa; 
          margin: 0; 
          padding: 15px 0;
          line-height: 1.5;
        }
        .email-wrapper { 
          max-width: 600px; 
          margin: 0 auto; 
          background: #ffffff;
        }
        .header { 
          background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); 
          padding: 25px 20px; 
          text-align: center;
        }
        .logo {
          max-width: 150px;
          height: auto;
          display: block;
          margin: 0 auto 10px;
        }
        .header-title {
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          margin: 0;
        }
        .content { 
          padding: 25px 20px; 
          background: #ffffff;
        }
        .greeting {
          font-size: 16px;
          color: #1e293b;
          margin: 0 0 15px 0;
        }
        .greeting strong {
          color: #FF6B35;
        }
        .credentials-box { 
          background: #f8fafc; 
          border: 1px solid #e2e8f0; 
          border-radius: 8px; 
          padding: 15px; 
          margin: 15px 0;
        }
        .credentials-table {
          width: 100%;
          border-collapse: collapse;
        }
        .credentials-table tr {
          border-bottom: 1px solid #e2e8f0;
        }
        .credentials-table tr:last-child {
          border-bottom: none;
        }
        .credentials-table td {
          padding: 12px 0;
          vertical-align: middle;
        }
        .credential-label { 
          color: #64748b; 
          font-weight: 600;
          font-size: 14px;
          width: 120px;
          padding-right: 15px;
        }
        .credential-value { 
          color: #1e293b; 
          font-family: 'Courier New', monospace; 
          background: #ffffff; 
          padding: 6px 12px; 
          border-radius: 4px;
          font-weight: 600;
          font-size: 14px;
          border: 1px solid #cbd5e1;
          display: inline-block;
          min-width: 150px;
        }
        .role-badge { 
          display: inline-block; 
          background: #3b82f6; 
          color: #ffffff; 
          padding: 4px 12px; 
          border-radius: 12px; 
          font-weight: 600; 
          font-size: 12px;
        }
        .cta-container {
          text-align: center;
          margin: 20px 0;
        }
        .cta-button { 
          display: inline-block; 
          background: linear-gradient(135deg, #FF6B35, #F7931E); 
          color: #ffffff; 
          padding: 12px 30px; 
          border-radius: 6px; 
          text-decoration: none; 
          font-weight: 600;
          font-size: 15px;
        }
        .warning { 
          background: #fef3c7; 
          border-left: 3px solid #f59e0b; 
          border-radius: 4px; 
          padding: 12px 15px; 
          margin-top: 15px; 
          color: #92400e;
          font-size: 13px;
        }
        .footer { 
          background: #f8fafc; 
          padding: 15px 20px; 
          text-align: center; 
          color: #64748b; 
          font-size: 11px;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 3px 0;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header">
          <img src="${logoUrl}" alt="${appName} Logo" class="logo" />
          <h1 class="header-title">Account Created</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello <strong>${name}</strong>,</p>
          <p style="color: #475569; font-size: 14px; margin: 0 0 15px 0;">Your account has been created. Use the credentials below to login:</p>
          
          <div class="credentials-box">
            <table class="credentials-table">
              <tr>
                <td class="credential-label">Username</td>
                <td><span class="credential-value">${username}</span></td>
              </tr>
              <tr>
                <td class="credential-label">Password</td>
                <td><span class="credential-value">${password}</span></td>
              </tr>
              <tr>
                <td class="credential-label">Role</td>
                <td><span class="role-badge">${role}</span></td>
              </tr>
            </table>
          </div>
          
          <div class="cta-container">
            <a href="${appUrl}/login" class="cta-button">Login Now</a>
          </div>
          
          <div class="warning">
            <strong>⚠️</strong> Please change your password after first login.
          </div>
        </div>
        <div class="footer">
          <p><strong>${appName}</strong></p>
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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          background-color: #f5f7fa; 
          margin: 0; 
          padding: 15px 0;
          line-height: 1.5;
        }
        .email-wrapper { 
          max-width: 600px; 
          margin: 0 auto; 
          background: #ffffff;
        }
        .header { 
          background: linear-gradient(135deg, #F7931E 0%, #FF6B35 100%); 
          padding: 25px 20px; 
          text-align: center;
        }
        .logo {
          max-width: 150px;
          height: auto;
          display: block;
          margin: 0 auto 10px;
        }
        .header-title {
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          margin: 0;
        }
        .content { 
          padding: 25px 20px; 
          background: #ffffff;
        }
        .greeting {
          font-size: 16px;
          color: #1e293b;
          margin: 0 0 15px 0;
        }
        .greeting strong {
          color: #FF6B35;
        }
        .info-box { 
          background: #eff6ff; 
          border-left: 3px solid #3b82f6; 
          border-radius: 4px; 
          padding: 12px 15px; 
          margin-bottom: 15px; 
          color: #1e40af;
          font-size: 13px;
        }
        .credentials-box { 
          background: #fffbeb; 
          border: 1px solid #fcd34d; 
          border-radius: 8px; 
          padding: 15px; 
          margin: 15px 0;
        }
        .credentials-table {
          width: 100%;
          border-collapse: collapse;
        }
        .credentials-table tr {
          border-bottom: 1px solid #fcd34d;
        }
        .credentials-table tr:last-child {
          border-bottom: none;
        }
        .credentials-table td {
          padding: 12px 0;
          vertical-align: middle;
        }
        .credential-label { 
          color: #92400e; 
          font-weight: 600;
          font-size: 14px;
          width: 120px;
          padding-right: 15px;
        }
        .credential-value { 
          color: #1e293b; 
          font-family: 'Courier New', monospace; 
          background: #ffffff; 
          padding: 6px 12px; 
          border-radius: 4px;
          font-weight: 700;
          font-size: 14px;
          border: 1px solid #fcd34d;
          display: inline-block;
          min-width: 150px;
        }
        .role-badge { 
          display: inline-block; 
          background: #3b82f6; 
          color: #ffffff; 
          padding: 4px 12px; 
          border-radius: 12px; 
          font-weight: 600; 
          font-size: 12px;
        }
        .cta-container {
          text-align: center;
          margin: 20px 0;
        }
        .cta-button { 
          display: inline-block; 
          background: linear-gradient(135deg, #F7931E, #FF6B35); 
          color: #ffffff; 
          padding: 12px 30px; 
          border-radius: 6px; 
          text-decoration: none; 
          font-weight: 600;
          font-size: 15px;
        }
        .warning { 
          background: #fee2e2; 
          border-left: 3px solid #ef4444; 
          border-radius: 4px; 
          padding: 12px 15px; 
          margin-top: 15px; 
          color: #b91c1c;
          font-size: 13px;
        }
        .footer { 
          background: #f8fafc; 
          padding: 15px 20px; 
          text-align: center; 
          color: #64748b; 
          font-size: 11px;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 3px 0;
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="header">
          <img src="${logoUrl}" alt="${appName} Logo" class="logo" />
          <h1 class="header-title">Password Reset</h1>
        </div>
        <div class="content">
          <p class="greeting">Hello <strong>${name}</strong>,</p>
          
          <div class="info-box">
            <strong>ℹ️</strong> Your password has been reset. Use the new credentials below:
          </div>
          
          <div class="credentials-box">
            <table class="credentials-table">
              <tr>
                <td class="credential-label">Username</td>
                <td><span class="credential-value">${username}</span></td>
              </tr>
              <tr>
                <td class="credential-label">New Password</td>
                <td><span class="credential-value">${newPassword}</span></td>
              </tr>
              <tr>
                <td class="credential-label">Role</td>
                <td><span class="role-badge">${role}</span></td>
              </tr>
            </table>
          </div>
          
          <div class="cta-container">
            <a href="${appUrl}/login" class="cta-button">Login Now</a>
          </div>
          
          <div class="warning">
            <strong>⚠️</strong> Change your password after login. If you didn't request this, contact admin.
          </div>
        </div>
        <div class="footer">
          <p><strong>${appName}</strong></p>
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
