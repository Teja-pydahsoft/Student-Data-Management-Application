const nodemailer = require('nodemailer');

// App configuration from environment
const appName = process.env.APP_NAME || 'Pydah Student Database';
const appUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Send email via Brevo SMTP (more reliable than API in restricted networks)
 */
const sendBrevoEmail = async ({ to, toName, subject, htmlContent }) => {
  const smtpKey = process.env.BREVO_SMTP_KEY || process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_FROM || 'careers@pydahsoft.in';
  const senderName = process.env.EMAIL_SENDER_NAME || 'Pydah Student Database';

  console.log('📧 Sending email via Brevo SMTP:', {
    to,
    from: senderEmail,
    smtpKey: smtpKey ? `${smtpKey.substring(0, 15)}...` : 'NOT SET'
  });

  if (!smtpKey) {
    console.warn('⚠️ BREVO_SMTP_KEY not set in .env');
    return { success: false, message: 'Email service not configured - BREVO_SMTP_KEY missing' };
  }

  try {
    // Create transporter with Brevo SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: senderEmail,
        pass: smtpKey
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: toName ? `"${toName}" <${to}>` : to,
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to} (Message ID: ${info.messageId})`);
    return { success: true, message: 'Email sent successfully', messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    
    // If SMTP fails, log but don't fail the entire operation
    // User was still created successfully
    return { success: false, message: error.message };
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

