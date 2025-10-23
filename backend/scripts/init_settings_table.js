const { supabase } = require('../config/supabase');

async function initSettingsTable() {
  try {
    console.log('🔧 Initializing settings table in Supabase...');

    // Since we can't create tables directly via Supabase client,
    // we'll provide instructions and try to insert with error handling
    try {
      // Try to insert the default setting
      const { error: insertError } = await supabase
        .from('settings')
        .upsert({ key: 'auto_assign_series', value: 'false' }, { onConflict: 'key' });

      if (insertError) {
        if (insertError.code === 'PGRST205') {
          console.error('❌ Settings table does not exist in Supabase.');
          console.log('📋 Please create the settings table manually in your Supabase dashboard:');
          console.log(`
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default setting
INSERT INTO settings (key, value) VALUES ('auto_assign_series', 'false')
ON CONFLICT (key) DO NOTHING;
          `);
          console.log('🔗 Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql');
          console.log('   Then run the SQL commands above.');
        } else {
          console.error('Error inserting default setting:', insertError);
        }
      } else {
        console.log('✅ Default setting inserted successfully');
      }
    } catch (error) {
      console.error('Error initializing settings:', error);
    }

  } catch (error) {
    console.error('Init settings table error:', error);
  }
}

initSettingsTable();