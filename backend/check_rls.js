const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/sreejareddy/Desktop/klh/backend/.env' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
async function run() {
  const { data, error } = await supabase.rpc('get_rls', {}); 
  // Let's just run a direct SQL query to check pg_class
}
run();
