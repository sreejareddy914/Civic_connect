const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/sreejareddy/Desktop/klh/backend/.env' });
require('dotenv').config({ path: '/Users/sreejareddy/Desktop/klh/frontend/.env' });
globalThis.WebSocket = require('ws');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false }});
async function run() {
  const { data, error } = await supabase.from('issues').select('id, title, issue_media(*)').order('created_at', { ascending: false }).limit(5);
  console.log("ANON QUERY: ", JSON.stringify(data, null, 2), error);
}
run();
