import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function check() {
  const { data, error } = await supabase.from('issue_verifications').select('id').limit(1);
  if (error) {
    console.log("Error querying issue_verifications:", error.message);
  } else {
    console.log("issue_verifications table exists!");
  }
}
check();
