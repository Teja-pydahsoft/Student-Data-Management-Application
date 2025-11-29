const { supabase } = require('../config/supabase');

const NOTIFICATION_TYPES = {
  user_creation: {
    key: 'user_creation',
    defaultEmailSubject: 'Your Account Has Been Created',
    defaultEmailTemplate: `Hello {{name}},

Your account has been created successfully. Below are your login credentials:

Username: {{username}}
Password: {{password}}
Role: {{role}}

Please change your password after your first login.

Login URL: {{loginUrl}}`,
    defaultSmsTemplate: `Hello {{name}}, your account has been created. Username: {{username}}, Password: {{password}}. Login: {{loginUrl}}`
  },
  password_update: {
    key: 'password_update',
    defaultEmailSubject: 'Your Password Has Been Updated',
    defaultEmailTemplate: `Hello {{name}},

Your password has been updated successfully.

Username: {{username}}
New Password: {{password}}

Please change your password after your first login.

Login URL: {{loginUrl}}`,
    defaultSmsTemplate: `Hello {{name}}, your password has been updated. Username: {{username}}, New Password: {{password}}. Login: {{loginUrl}}`
  },
  attendance_absent: {
    key: 'attendance_absent',
    defaultEmailSubject: 'Attendance Alert - Student Absent',
    defaultEmailTemplate: `Dear Parent/Guardian,

This is to inform you that your ward {{studentName}} (Admission No: {{admissionNumber}}) was marked absent on {{date}}.

Please contact the college if you have any concerns.

Thank you.`,
    defaultSmsTemplate: `Dear Parent, {#var#} is absent today i.e., on {#var#}Principal, PYDAH.`
  }
};

/**
 * GET /api/settings/notifications
 * Get all notification settings
 */
exports.getNotificationSettings = async (req, res) => {
  try {
    // Try to fetch from Supabase
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .like('key', 'notification_%');

    if (error && error.code !== 'PGRST205') {
      throw error;
    }

    // Build settings object from database or use defaults
    const settingsObj = {};
    
    if (settings && settings.length > 0) {
      settings.forEach(item => {
        const key = item.key.replace('notification_', '');
        try {
          settingsObj[key] = JSON.parse(item.value);
        } catch (e) {
          // If parsing fails, use default
          const type = Object.values(NOTIFICATION_TYPES).find(t => t.key === key);
          if (type) {
            settingsObj[key] = {
              enabled: true,
              emailEnabled: true,
              smsEnabled: true,
              emailSubject: type.defaultEmailSubject,
              emailTemplate: type.defaultEmailTemplate,
              smsTemplate: type.defaultSmsTemplate
            };
          }
        }
      });
    }

    // Ensure all notification types have settings
    Object.values(NOTIFICATION_TYPES).forEach(type => {
      if (!settingsObj[type.key]) {
        settingsObj[type.key] = {
          enabled: true,
          emailEnabled: true,
          smsEnabled: true,
          emailSubject: type.defaultEmailSubject,
          emailTemplate: type.defaultEmailTemplate,
          smsTemplate: type.defaultSmsTemplate
        };
      }
    });

    res.json({
      success: true,
      data: settingsObj
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notification settings'
    });
  }
};

/**
 * PUT /api/settings/notifications
 * Update notification settings
 */
exports.updateNotificationSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    // Validate and prepare settings for storage
    const settingsToSave = [];
    
    for (const [key, value] of Object.entries(settings)) {
      // Validate key is a known notification type
      if (!NOTIFICATION_TYPES[key]) {
        continue; // Skip unknown types
      }

      // Validate structure
      if (typeof value !== 'object' || value === null) {
        continue;
      }

      // Ensure required fields exist
      const setting = {
        enabled: value.enabled !== false,
        emailEnabled: value.emailEnabled !== false,
        smsEnabled: value.smsEnabled !== false,
        emailSubject: value.emailSubject || NOTIFICATION_TYPES[key].defaultEmailSubject,
        emailTemplate: value.emailTemplate || NOTIFICATION_TYPES[key].defaultEmailTemplate,
        smsTemplate: value.smsTemplate || NOTIFICATION_TYPES[key].defaultSmsTemplate
      };

      settingsToSave.push({
        key: `notification_${key}`,
        value: JSON.stringify(setting)
      });
    }

    // Save to Supabase using upsert
    for (const setting of settingsToSave) {
      const { error } = await supabase
        .from('settings')
        .upsert(
          {
            key: setting.key,
            value: setting.value,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        );

      if (error) {
        console.error(`Error saving setting ${setting.key}:`, error);
        // Continue with other settings even if one fails
      }
    }

    res.json({
      success: true,
      message: 'Notification settings saved successfully'
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating notification settings'
    });
  }
};

/**
 * Get notification setting for a specific type
 * Used internally by other controllers
 */
exports.getNotificationSetting = async (typeKey) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', `notification_${typeKey}`)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (data && data.value) {
      try {
        return JSON.parse(data.value);
      } catch (e) {
        // Return default if parsing fails
        const type = NOTIFICATION_TYPES[typeKey];
        if (type) {
          return {
            enabled: true,
            emailEnabled: true,
            smsEnabled: true,
            emailSubject: type.defaultEmailSubject,
            emailTemplate: type.defaultEmailTemplate,
            smsTemplate: type.defaultSmsTemplate
          };
        }
      }
    }

    // Return default if not found
    const type = NOTIFICATION_TYPES[typeKey];
    if (type) {
      return {
        enabled: true,
        emailEnabled: true,
        smsEnabled: true,
        emailSubject: type.defaultEmailSubject,
        emailTemplate: type.defaultEmailTemplate,
        smsTemplate: type.defaultSmsTemplate
      };
    }

    return null;
  } catch (error) {
    console.error(`Error getting notification setting for ${typeKey}:`, error);
    // Return default on error
    const type = NOTIFICATION_TYPES[typeKey];
    if (type) {
      return {
        enabled: true,
        emailEnabled: true,
        smsEnabled: true,
        emailSubject: type.defaultEmailSubject,
        emailTemplate: type.defaultEmailTemplate,
        smsTemplate: type.defaultSmsTemplate
      };
    }
    return null;
  }
};

