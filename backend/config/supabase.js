const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

console.log('🔧 Supabase Configuration:');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'Not set');
console.log('SUPABASE_KEY:', SUPABASE_KEY ? 'Set' : 'Not set');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️  Supabase env missing (SUPABASE_URL/SUPABASE_KEY). Staging features will fail.');
}

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

if (supabase) {
  console.log('✅ Supabase client created successfully');
} else {
  console.log('⚠️  Supabase client not created - missing credentials');
}

module.exports = { supabase };
