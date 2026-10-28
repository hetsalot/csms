require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log(`[Supabase] Client initialized for ${supabaseUrl}`);
  } catch (err) {
    console.warn('[Supabase] Initialization warning:', err.message);
  }
}

function isSupabaseConfigured() {
  return !!supabase;
}

module.exports = {
  supabase,
  isSupabaseConfigured
};
