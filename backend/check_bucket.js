const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/sreejareddy/Desktop/klh/backend/.env' });
globalThis.WebSocket = require('ws');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false }});
async function run() {
  const { data, error } = await supabase.storage.getBucket('issues');
  console.log("Bucket issues:", data, error);
}
run();
